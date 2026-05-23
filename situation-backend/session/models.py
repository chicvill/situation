from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class OrderItem(BaseModel):
    name: str
    price: int
    quantity: int


class OrderRequest(BaseModel):
    store_id: str
    table_id: str
    device_id: str
    items: List[OrderItem]
    total_price: int
    payment_status: Optional[str] = "unpaid"
    payment_method: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    join_order: Optional[bool] = False


class StatusUpdate(BaseModel):
    order_id: str
    status: str


class StoreCreateRequest(BaseModel):
    store_id: str
    store_name: str
    owner_name: str
    owner_id: str
    monthly_fee: int
    payment_status: str
    payment_history: Optional[List[Dict[str, Any]]] = []


class StoreUpdateRequest(BaseModel):
    store_name: str
    owner_name: str
    owner_id: str
    monthly_fee: int
    payment_status: str
    payment_history: Optional[List[Dict[str, Any]]] = []
