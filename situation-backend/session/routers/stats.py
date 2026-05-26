from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime, timedelta
from ..database import get_db_conn
from psycopg2.extras import RealDictCursor
import json

router = APIRouter(tags=["stats"])


@router.get("/api/stats/store/{store_id}")
async def get_store_stats(store_id: str, period: str = Query("daily", pattern="^(daily|weekly|monthly)$")):
    # 🌟 Debug Log: Record the exact store_id queried by the frontend browser
    try:
        import os
        log_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scratch", "request_logs.txt")
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] GET /api/stats/store/{store_id}?period={period}\n")
    except Exception as e:
        print(f"[DebugLog Error] {e}")

    conn = get_db_conn()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Period-based Sales Trend
        trend_data = []
        if period == "daily":
            # Last 30 days
            since_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
            cur.execute("""
                SELECT 
                    SUBSTRING(checkout_time FROM 1 FOR 10) AS label,
                    SUM(total_revenue) AS amount
                FROM session_archive
                WHERE store_id = %s AND checkout_time >= %s
                GROUP BY label
                ORDER BY label ASC
            """, (store_id, since_date))
            trend_data = [dict(row) for row in cur.fetchall()]
            
        elif period == "weekly":
            # Last 12 weeks
            since_date = (datetime.now() - timedelta(weeks=12)).strftime("%Y-%m-%d %H:%M:%S")
            # Group by week truncating and format as YYYY-WIW
            cur.execute("""
                SELECT 
                    TO_CHAR(DATE_TRUNC('week', TO_TIMESTAMP(REPLACE(checkout_time, 'T', ' '), 'YYYY-MM-DD HH24:MI:SS')), 'YYYY-"W"IW') AS label,
                    SUM(total_revenue) AS amount
                FROM session_archive
                WHERE store_id = %s AND checkout_time >= %s
                GROUP BY label
                ORDER BY label ASC
            """, (store_id, since_date))
            trend_data = [dict(row) for row in cur.fetchall()]
            
        elif period == "monthly":
            # Last 6 months
            since_date = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d %H:%M:%S")
            cur.execute("""
                SELECT 
                    SUBSTRING(checkout_time FROM 1 FOR 7) AS label,
                    SUM(total_revenue) AS amount
                FROM session_archive
                WHERE store_id = %s AND checkout_time >= %s
                GROUP BY label
                ORDER BY label ASC
            """, (store_id, since_date))
            trend_data = [dict(row) for row in cur.fetchall()]

        # 2. Menu-wise sales ordered by rank
        cur.execute("""
            SELECT 
                elem->>'name' AS name,
                SUM((elem->>'qty')::int) AS qty,
                SUM((elem->>'qty')::int * (elem->>'price')::int) AS amount
            FROM 
                session_archive,
                jsonb_array_elements(items_summary) AS elem
            WHERE 
                store_id = %s
            GROUP BY 
                name
            ORDER BY 
                amount DESC
        """, (store_id,))
        menu_sales = [dict(row) for row in cur.fetchall()]

        # 3. Day-of-Week Sales Trend (DOW)
        cur.execute("""
            SELECT 
                EXTRACT(ISODOW FROM TO_TIMESTAMP(REPLACE(checkout_time, 'T', ' '), 'YYYY-MM-DD HH24:MI:SS'))::int AS dow,
                SUM(total_revenue) AS amount,
                COUNT(session_id) AS count
            FROM session_archive
            WHERE store_id = %s AND checkout_time IS NOT NULL AND checkout_time != ''
            GROUP BY dow
            ORDER BY dow ASC
        """, (store_id,))
        dow_sales = [dict(row) for row in cur.fetchall()]

        # 4. Menu Sales by Day of Week (DOW)
        cur.execute("""
            SELECT 
                EXTRACT(ISODOW FROM TO_TIMESTAMP(REPLACE(checkout_time, 'T', ' '), 'YYYY-MM-DD HH24:MI:SS'))::int AS dow,
                elem->>'name' AS menu_name,
                SUM((elem->>'qty')::int) AS qty,
                SUM((elem->>'qty')::int * (elem->>'price')::int) AS amount
            FROM 
                session_archive,
                jsonb_array_elements(items_summary) AS elem
            WHERE 
                store_id = %s AND checkout_time IS NOT NULL AND checkout_time != ''
            GROUP BY 
                dow, menu_name
            ORDER BY 
                dow ASC, amount DESC
        """, (store_id,))
        menu_dow_sales = [dict(row) for row in cur.fetchall()]

        cur.close()
        conn.close()
        
        return {
            "period": period,
            "trend": trend_data,
            "menuSales": menu_sales,
            "dowSales": dow_sales,
            "menuDowSales": menu_dow_sales
        }
        
    except Exception as e:
        print(f"[get_store_stats] ERROR: {e}")
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/stats/admin")
async def get_admin_stats():
    conn = get_db_conn()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Last 6 months of store-wise monthly revenue
        since_date = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d %H:%M:%S")
        
        cur.execute("""
            SELECT 
                sa.store_id,
                COALESCE(s.name, sa.store_id) AS store_name,
                SUBSTRING(sa.checkout_time FROM 1 FOR 7) AS label,
                SUM(sa.total_revenue) AS amount
            FROM 
                session_archive sa
            LEFT JOIN 
                stores s ON sa.store_id = s.id
            WHERE 
                sa.checkout_time >= %s
            GROUP BY 
                sa.store_id, store_name, label
            ORDER BY 
                label ASC, amount DESC
        """, (since_date,))
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        # Structure the data to make it extremely easy for frontend horizontal bar rendering
        # Grouped by month, with store revenues
        # e.g., { "2026-05": [ { "store_name": "시크빌", "amount": 54000000 }, ... ] }
        monthly_data = {}
        for r in rows:
            label = r["label"]
            store_name = r["store_name"]
            amount = r["amount"]
            
            if label not in monthly_data:
                monthly_data[label] = []
            
            monthly_data[label].append({
                "store_id": r["store_id"],
                "store_name": store_name,
                "amount": amount
            })
            
        return {
            "monthlyStoreSales": monthly_data
        }
        
    except Exception as e:
        print(f"[get_admin_stats] ERROR: {e}")
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))
