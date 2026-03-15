import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    sessions = relationship("GameSession", back_populates="user")

class GameSession(Base):
    __tablename__ = "game_sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    gold = Column(Integer, default=200)
    lives = Column(Integer, default=20)
    wave = Column(Integer, default=0)
    phase = Column(String, default="idle")   # idle | active | settling
    skill_pts = Column(Integer, default=0)
    player_skills = Column(JSON, default=list)   # list of owned skill keys
    active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = relationship("User", back_populates="sessions")
    towers = relationship("Tower", back_populates="session", cascade="all, delete-orphan")

class Tower(Base):
    __tablename__ = "towers"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(Integer, ForeignKey("game_sessions.id"), nullable=False)
    type = Column(String, nullable=False)   # squirrel | lion | ... | factory | clam | ...
    x = Column(Integer, nullable=False)
    y = Column(Integer, nullable=False)
    level = Column(Integer, default=0)
    has_laser = Column(Boolean, default=False)
    laser_lvl = Column(Integer, default=0)
    laser_range = Column(Float, default=3.0)
    owned_skills = Column(JSON, default=list)   # list of owned skill keys: ['A'], ['B', 'C'], etc.
    disabled = Column(Boolean, default=False)
    session = relationship("GameSession", back_populates="towers")
