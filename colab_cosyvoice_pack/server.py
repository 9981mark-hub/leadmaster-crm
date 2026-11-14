import os
import io
import json
import torch
import torchaudio
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="LeadMaster CRM - CosyVoice 2 Colab API Server")

# 모든 도메인 CORS 허용 (CRM 브라우저에서 직접 fetch 가능)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 메타데이터 로드
METADATA_FILE = "voices_metadata.json"
VOICE_MAP = {}
if os.path.exists(METADATA_FILE):
    with open(METADATA_FILE, "r", encoding="utf-8") as f:
        profiles = json.load(f)
        for p in profiles:
            VOICE_MAP[p["voice_id"]] = p

print(f"Loaded {len(VOICE_MAP)} reference voices.")

# CosyVoice 2 모델 로더 (지연 로딩 또는 전역 싱글톤)
cosyvoice = None

def get_cosyvoice():
    global cosyvoice
    if cosyvoice is None:
        print("Initializing CosyVoice 2 model on GPU...")
        try:
            from cosyvoice.cli.cosyvoice import CosyVoice2
            cosyvoice = CosyVoice2('speech_tts/CosyVoice2-0.5B')
            print("CosyVoice 2 initialized successfully!")
        except Exception as e:
            print("CosyVoice 2 import failed, attempting fallback to CosyVoice 1 or F5-TTS:", e)
            try:
                from cosyvoice.cli.cosyvoice import CosyVoice
                cosyvoice = CosyVoice('speech_tts/CosyVoice-300M')
            except Exception as e2:
                print("Fallback also failed:", e2)
                raise e2
    return cosyvoice

class TTSRequest(BaseModel):
    voice_id: str
    text: str
    emotion: Optional[str] = None
    speed: Optional[float] = 1.0

@app.get("/health")
def health():
    return {
        "status": "online",
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
        "vram_allocated_gb": f"{torch.cuda.memory_allocated(0)/(1024**3):.2f}" if torch.cuda.is_available() else "N/A",
        "available_voices": list(VOICE_MAP.keys())
    }

@app.post("/tts/clone")
async def clone_voice(req: TTSRequest):
    if req.voice_id not in VOICE_MAP:
        raise HTTPException(status_code=404, detail=f"Voice ID {req.voice_id} not found")
    
    profile = VOICE_MAP[req.voice_id]
    ref_wav_path = os.path.join("ref_voices", profile["ref_file"])
    if not os.path.exists(ref_wav_path):
        raise HTTPException(status_code=404, detail=f"Reference WAV {ref_wav_path} not found")

    prompt_text = profile["prompt_text"]
    tts_model = get_cosyvoice()

    try:
        # CosyVoice Zero-shot inference
        # 감정 지시어가 있으면 instruct 모드, 없으면 cross_lingual / zero_shot 모드
        if req.emotion and hasattr(tts_model, 'inference_instruct'):
            instruct_text = f"<{req.emotion}>"
            outputs = tts_model.inference_instruct(
                req.text,
                instruct_text,
                ref_wav_path,
                speed=req.speed or 1.0
            )
        else:
            outputs = tts_model.inference_zero_shot(
                req.text,
                prompt_text,
                ref_wav_path,
                speed=req.speed or 1.0
            )

        # 첫 번째 오디오 청크 추출
        audio_tensor = None
        for out in outputs:
            audio_tensor = out['tts_speech']
            break

        if audio_tensor is None:
            raise HTTPException(status_code=500, detail="No audio produced from CosyVoice")

        # WAV 바이너리로 인코딩
        buffer = io.BytesIO()
        torchaudio.save(buffer, audio_tensor, 22050, format="wav")
        buffer.seek(0)

        return Response(content=buffer.read(), media_type="audio/wav")

    except Exception as e:
        print(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
