import psycopg2
import os
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())
DATABASE_URL = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    # Try deleting a dummy/test store or check constraints on the 'stores' table
    cur.execute("""
        SELECT
            tc.table_schema, 
            tc.constraint_name, 
            tc.table_name, 
            kcu.column_name, 
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name='stores';
    """)
    rows = cur.fetchall()
    print("Constraints pointing to 'stores':")
    for r in rows:
        print(r)
    
    # Also attempt to execute the delete of 'chicvill' or similar and print the exact error
    try:
        cur.execute("DELETE FROM stores WHERE id = 'chicvill'")
        conn.commit()
        print("Delete successful!")
    except Exception as e:
        print("Delete failed with error:")
        print(e)
    
    cur.close()
    conn.close()
except Exception as main_e:
    print("Main script error:", main_e)
