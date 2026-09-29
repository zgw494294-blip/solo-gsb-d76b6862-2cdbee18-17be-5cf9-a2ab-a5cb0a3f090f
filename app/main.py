"""FastAPI 入口: 静态页面 + /api/judge 裁决接口。"""
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .solver import JudgeError, judge

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="本地赛道计次裁决台")


@app.exception_handler(JudgeError)
async def judge_error_handler(_request: Request, exc: JudgeError) -> JSONResponse:
    # 非法输入: 返回 422 与全部错误, 不展示任何部分结果
    return JSONResponse(status_code=422, content={"ok": False, "errors": exc.errors})


@app.post("/api/judge")
async def api_judge(request: Request) -> JSONResponse:
    try:
        payload = await request.json()
    except ValueError:
        return JSONResponse(
            status_code=422,
            content={"ok": False, "errors": ["请求体不是合法的 JSON"]},
        )
    result = judge(payload)
    return JSONResponse({"ok": True, **result})


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
