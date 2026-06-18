# app/services/skill_selector.py

from typing import List


def select_skills(rfq_data: dict) -> dict:
    """
    Select applicable skills based on RFQ content.
    """

    product_skills: List[str] = []
    commercial_skills: List[str] = ["terms_skill", "pricing_skill"]

    rfq_text = str(rfq_data).lower()

    # ------------------------------------------------
    # PRODUCT SKILLS
    # ------------------------------------------------

    # Vessel / Tank
    if any(word in rfq_text for word in [
        "tank",
        "vessel",
        "receiver",
        "storage"
    ]):
        product_skills.append("vessel_skill")

    # Reactor
    if any(word in rfq_text for word in [
        "reactor",
        "agitator",
        "limpet",
        "jacketed"
    ]):
        product_skills.append("reactor_skill")

    # Column
    if any(word in rfq_text for word in [
        "column",
        "distillation",
        "tower",
        "packed column",
        "stripper"
    ]):
        product_skills.append("column_skill")

    # Heat Exchanger / Condenser
    if any(word in rfq_text for word in [
        "condenser",
        "condensor",
        "heat exchanger",
        "shell & tube",
        "shell and tube",
        "s&t",
        "reboiler"
    ]):
        product_skills.append("heat_exchanger_skill")

    # Turnkey
    if any(word in rfq_text for word in [
        "turnkey",
        "plant",
        "skid",
        "system",
        "module"
    ]):
        product_skills.append("turnkey_skill")

    # ------------------------------------------------
    # INDUSTRY / DOMAIN SKILLS
    # ------------------------------------------------

    # if any(word in rfq_text for word in [
    #     "pharma",
    #     "cip",
    #     "sip",
    #     "electropolish"
    # ]):
    #     product_skills.append("pharma_skill")

    # if any(word in rfq_text for word in [
    #     "solvent",
    #     "vacuum",
    #     "fv",
    #     "torr"
    # ]):
    #     product_skills.append("solvent_system_skill")

    # Remove duplicates while preserving prompt order.
    product_skills = list(dict.fromkeys(product_skills))

    return {
        "product_skills": product_skills,
        "commercial_skills": commercial_skills
    }
