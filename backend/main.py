from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import engine
import models
from routers import auth, game

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Goblin Siege API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # restrict to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(game.router)

@app.get("/")
def root():
    return {"status": "ok"}
