"""API routes."""
# app/api/routes.py
from fastapi import APIRouter, UploadFile, File
from app.worker.tasks import process_rfq_task

router = APIRouter()

@router.post("/rfq")
async def submit_rfq(file: UploadFile = File(...)):
    file_path = f"data/uploads/{file.filename}"
    
    with open(file_path, "wb") as f:
        f.write(await file.read())

    task = process_rfq_task.delay(file_path)

    return {"task_id": task.id}


@router.get("/status/{task_id}")
def get_status(task_id: str):
    from celery.result import AsyncResult
    res = AsyncResult(task_id)
    return {"status": res.status}


@router.get("/result/{task_id}")
def get_result(task_id: str):
    from celery.result import AsyncResult
    res = AsyncResult(task_id)
    return {"result": res.result}