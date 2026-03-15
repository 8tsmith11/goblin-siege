import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db import get_db
import models, schemas, security, game as G

router = APIRouter(prefix="/game", tags=["game"])

def _active_session(user: models.User, db: Session) -> models.GameSession:
    sess = db.query(models.GameSession).filter(
        models.GameSession.user_id == user.id,
        models.GameSession.active == True
    ).first()
    if not sess:
        raise HTTPException(404, "No active game — call POST /game/new first")
    return sess

def _tower_or_404(tower_id: str, sess: models.GameSession, db: Session) -> models.Tower:
    tower = db.query(models.Tower).filter(
        models.Tower.id == tower_id,
        models.Tower.session_id == sess.id
    ).first()
    if not tower:
        raise HTTPException(404, "Tower not found")
    return tower

def _tower_out(t: models.Tower) -> schemas.TowerOut:
    return schemas.TowerOut(
        id=t.id, type=t.type, x=t.x, y=t.y, level=t.level,
        has_laser=t.has_laser, laser_lvl=t.laser_lvl, laser_range=t.laser_range,
        owned_skills=t.owned_skills or [], disabled=t.disabled,
    )

# ── New game ──────────────────────────────────────────────────────────────────

@router.post("/new", response_model=schemas.GameStateOut)
def new_game(user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    # Deactivate any existing sessions
    db.query(models.GameSession).filter(
        models.GameSession.user_id == user.id, models.GameSession.active == True
    ).update({"active": False})
    sess = models.GameSession(user_id=user.id, gold=200, lives=20, wave=0,
                               phase="idle", skill_pts=0, player_skills=[])
    db.add(sess); db.commit(); db.refresh(sess)
    return schemas.GameStateOut(gold=sess.gold, lives=sess.lives, wave=sess.wave,
                                phase=sess.phase, skill_pts=sess.skill_pts,
                                player_skills=[], towers=[])

# ── Load state ────────────────────────────────────────────────────────────────

@router.get("/state", response_model=schemas.GameStateOut)
def get_state(user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    sess = _active_session(user, db)
    return schemas.GameStateOut(
        gold=sess.gold, lives=sess.lives, wave=sess.wave, phase=sess.phase,
        skill_pts=sess.skill_pts, player_skills=sess.player_skills or [],
        towers=[_tower_out(t) for t in sess.towers],
    )

# ── Wave ──────────────────────────────────────────────────────────────────────

@router.post("/wave/start", response_model=schemas.WaveOut)
def start_wave(user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    sess = _active_session(user, db)
    if sess.phase == "active":
        raise HTTPException(400, "Wave already in progress")
    sess.wave += 1
    sess.phase = "active"
    db.commit()
    return schemas.WaveOut(**G.gen_wave(sess.wave))

@router.post("/wave/complete", response_model=schemas.WaveCompleteOut)
def complete_wave(
    body: schemas.KillReport,
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    sess = _active_session(user, db)
    if sess.phase != "active":
        raise HTTPException(400, "No active wave")
    new_gold, new_lives, sp_earned = G.validate_wave_complete(
        sess.wave, body.kills, body.leaks, sess.towers,
        sess.player_skills or [], sess.gold, sess.lives,
    )
    sess.gold = new_gold
    sess.lives = new_lives
    sess.skill_pts += sp_earned
    sess.phase = "idle"
    if new_lives <= 0:
        sess.active = False
    # Re-enable disabled towers
    for t in sess.towers:
        t.disabled = False
    db.commit()
    return schemas.WaveCompleteOut(gold=sess.gold, lives=sess.lives,
                                   skill_pts=sess.skill_pts, wave=sess.wave)

# ── Towers ────────────────────────────────────────────────────────────────────

@router.post("/towers", response_model=schemas.PlaceTowerOut)
def place_tower(
    body: schemas.PlaceTowerIn,
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    sess = _active_session(user, db)
    if body.type == "factory":
        factory_count = sum(1 for t in sess.towers if t.type == "factory")
        cost = G.factory_place_cost(factory_count)
    elif body.type in G.ALL_TOWER_COSTS:
        cost = G.ALL_TOWER_COSTS[body.type]
    else:
        raise HTTPException(400, f"Unknown tower type: {body.type}")
    if sess.gold < cost:
        raise HTTPException(400, "Not enough gold")
    tower = models.Tower(id=str(uuid.uuid4()), session_id=sess.id,
                         type=body.type, x=body.x, y=body.y)
    sess.gold -= cost
    db.add(tower); db.commit(); db.refresh(tower)
    return schemas.PlaceTowerOut(tower=_tower_out(tower), gold=sess.gold)

@router.patch("/towers/{tower_id}/upgrade", response_model=schemas.GoldOut)
def upgrade_tower(
    tower_id: str,
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    sess = _active_session(user, db)
    tower = _tower_or_404(tower_id, sess, db)
    cost = G.upgrade_cost(tower.type, tower.level)
    if sess.gold < cost:
        raise HTTPException(400, "Not enough gold")
    sess.gold -= cost
    tower.level += 1
    db.commit()
    return schemas.GoldOut(gold=sess.gold)

@router.delete("/towers/{tower_id}", response_model=schemas.GoldOut)
def sell_tower(
    tower_id: str,
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    sess = _active_session(user, db)
    tower = _tower_or_404(tower_id, sess, db)
    refund = G.sell_value(tower.type)
    sess.gold += refund
    db.delete(tower); db.commit()
    return schemas.GoldOut(gold=sess.gold)

@router.post("/towers/{tower_id}/laser", response_model=schemas.GoldOut)
def add_laser(
    tower_id: str,
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    sess = _active_session(user, db)
    tower = _tower_or_404(tower_id, sess, db)
    if tower.type != "factory":
        raise HTTPException(400, "Only factories can have lasers")
    if tower.has_laser:
        raise HTTPException(400, "Already has laser")
    cost = 60
    if sess.gold < cost:
        raise HTTPException(400, "Not enough gold")
    sess.gold -= cost
    tower.has_laser = True; tower.laser_lvl = 1; tower.laser_range = 3.0
    db.commit()
    return schemas.GoldOut(gold=sess.gold)

@router.patch("/towers/{tower_id}/laser", response_model=schemas.GoldOut)
def upgrade_laser(
    tower_id: str,
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    sess = _active_session(user, db)
    tower = _tower_or_404(tower_id, sess, db)
    if not tower.has_laser:
        raise HTTPException(400, "No laser to upgrade")
    cost = 30 + tower.laser_lvl * 15
    if sess.gold < cost:
        raise HTTPException(400, "Not enough gold")
    sess.gold -= cost
    tower.laser_lvl += 1
    tower.laser_range = 3.0 + tower.laser_lvl * 0.5
    db.commit()
    return schemas.GoldOut(gold=sess.gold)

@router.patch("/towers/{tower_id}/upgrade-income", response_model=schemas.GoldOut)
def upgrade_factory_income(
    tower_id: str,
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    sess = _active_session(user, db)
    tower = _tower_or_404(tower_id, sess, db)
    if tower.type != "factory":
        raise HTTPException(400, "Only factories support income upgrades")
    cost = 30 + tower.level * 20
    if sess.gold < cost:
        raise HTTPException(400, "Not enough gold")
    sess.gold -= cost
    tower.level += 1
    db.commit()
    return schemas.GoldOut(gold=sess.gold)

@router.post("/towers/{tower_id}/skill", response_model=schemas.SkillPtsOut)
def buy_tower_skill(
    tower_id: str,
    body: schemas.TowerSkillIn,
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    sess = _active_session(user, db)
    tower = _tower_or_404(tower_id, sess, db)
    owned = tower.owned_skills or []
    ok, reason = G.can_buy_tower_skill(body.skill, tower.type, owned)
    if not ok:
        raise HTTPException(400, reason)
    cost = G.TOWER_SKILL_COSTS.get(body.skill, 1)
    if sess.skill_pts < cost:
        raise HTTPException(400, "Not enough skill points")
    sess.skill_pts -= cost
    tower.owned_skills = owned + [body.skill]
    db.commit()
    return schemas.SkillPtsOut(skill_pts=sess.skill_pts)

# ── Spells ────────────────────────────────────────────────────────────────────

@router.post("/spells/cast", response_model=schemas.CastSpellOut)
def cast_spell(
    body: schemas.CastSpellIn,
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    sess = _active_session(user, db)
    if sess.phase != "active":
        raise HTTPException(400, "Spells can only be cast during a wave")
    cost = G.spell_cost(body.spell, sess.player_skills or [])
    if body.spell not in G.SPELL_COSTS:
        raise HTTPException(400, f"Unknown spell: {body.spell}")
    if sess.gold < cost:
        raise HTTPException(400, "Not enough gold")
    sess.gold -= cost

    effect = {}
    if body.spell == "heal":
        sess.lives = min(30, sess.lives + 3)
        effect = {"lives": sess.lives}
    elif body.spell == "goldBoost":
        bonus = 30 + sess.wave * 5
        sess.gold += bonus
        effect = {"bonus": bonus}
    elif body.spell == "thickWalls" in (sess.player_skills or []):
        pass  # handled client-side

    db.commit()
    return schemas.CastSpellOut(gold=sess.gold, effect=effect)

# ── Player skills ─────────────────────────────────────────────────────────────

@router.post("/skills/buy", response_model=schemas.SkillPtsOut)
def buy_skill(
    body: schemas.TowerSkillIn,   # reuse {skill: str} shape
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    sess = _active_session(user, db)
    owned = sess.player_skills or []
    ok, reason = G.can_buy_player_skill(body.skill, owned)
    if not ok:
        raise HTTPException(400, reason)
    cost = G.PLAYER_SKILL_COSTS[body.skill]
    if sess.skill_pts < cost:
        raise HTTPException(400, "Not enough skill points")
    sess.skill_pts -= cost
    sess.player_skills = owned + [body.skill]
    if body.skill == "thickWalls":
        sess.lives = min(sess.lives + 5, 30)
    db.commit()
    return schemas.SkillPtsOut(skill_pts=sess.skill_pts)
