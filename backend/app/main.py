from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router, callback
from app.routers.accounts import router as accounts_router
from app.routers.reports import router as reports_router
from app.routers.budget import router as budget_router
from app.routers.review import router as review_router

app = FastAPI(title="C3 Financial Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://finance.c3-church.com", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(accounts_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(budget_router, prefix="/api")
app.include_router(review_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}


# Root-level alias so Intuit's redirect URI (https://api.c3-church.com/callback) works
app.get("/callback")(callback)
