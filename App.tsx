
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Language, 
  LanguageLabels,
  VoiceSettings, 
  ProcessingState,
  VOICE_SITUATIONS,
  RECORDING_SCRIPTS,
  PREVIEW_TEXT,
  Gender
} from './types.ts';
import { 
  refineTextForSpeech, 
  generateAudio, 
  decodeAudioData
} from './services/geminiService.ts';

const VOICES = [
  { id: 'Zephyr', gender: 'Male' },
  { id: 'Kore', gender: 'Female' },
  { id: 'Fenrir', gender: 'Male' },
  { id: 'Puck', gender: 'Male' },
  { id: 'Charon', gender: 'Male' }
];

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<VoiceSettings & { volume: number, voicePreset: string, isCloned: boolean }>({
    language: Language.ENGLISH,
    gender: Gender.FEMALE,
    pitch: 1.0,
    rate: 1.0,
    volume: 1.0,
    voicePreset: 'Zephyr',
    isCloned: false
  });
  
  const [status, setStatus] = useState<ProcessingState>({
    isRefining: false,
    isSynthesizing: false,
    isRecording: false,
    error: null,
  });

  const [clonedVoiceBase64, setClonedVoiceBase64] = useState<string | null>(null);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderAnalyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isOutputPlaying, setIsOutputPlaying] = useState(false);
  const [generatedBuffer, setGeneratedBuffer] = useState<AudioBuffer | null>(null);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      gainNodeRef.current = audioContextRef.current.createGain();
      
      analyserRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(settings.volume, audioContextRef.current.currentTime);
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, [settings.volume]);

  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(settings.volume, audioContextRef.current.currentTime, 0.05);
    }
  }, [settings.volume]);

  const drawVisualizer = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / (bufferLength * 0.7)) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#f97316');
        gradient.addColorStop(1, '#ea580c');
        
        ctx.fillStyle = isOutputPlaying ? gradient : '#1a1a1a';
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };
    render();
  }, [isOutputPlaying]);

  const drawRecorderVisualizer = useCallback(() => {
    if (!recordCanvasRef.current || !recorderAnalyserRef.current) return;
    const canvas = recordCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = recorderAnalyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (!status.isRecording) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      requestAnimationFrame(render);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = 'rgba(3, 3, 3, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f97316';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    render();
  }, [status.isRecording]);

  useEffect(() => {
    drawVisualizer();
  }, [drawVisualizer]);

  useEffect(() => {
    if (status.isRecording) drawRecorderVisualizer();
  }, [status.isRecording, drawRecorderVisualizer]);

  const stopPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch (e) {}
      currentSourceRef.current = null;
    }
    setIsOutputPlaying(false);
  }, []);

  const handleRefine = async () => {
    if (!inputText.trim()) return;
    setStatus(prev => ({ ...prev, isRefining: true, error: null }));
    try {
      const refined = await refineTextForSpeech(inputText, settings.language);
      setInputText(refined);
    } catch (err: any) {
      setStatus(prev => ({ ...prev, error: "Refinement synchronization failed." }));
    } finally {
      setStatus(prev => ({ ...prev, isRefining: false }));
    }
  };

  const handleSpeak = async () => {
    initAudio();
    if (!inputText.trim()) {
      setStatus(prev => ({ ...prev, error: "Empty script buffer." }));
      return;
    }

    stopPlayback();
    setGeneratedBuffer(null);
    setStatus(prev => ({ ...prev, isSynthesizing: true, error: null }));

    try {
      const audioData = await generateAudio(
        inputText, 
        settings.voicePreset, 
        settings.isCloned, 
        clonedVoiceBase64 || undefined
      );
      
      if (audioData && audioContextRef.current && analyserRef.current) {
        const buffer = await decodeAudioData(audioData, audioContextRef.current);
        setGeneratedBuffer(buffer);
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(settings.rate, audioContextRef.current.currentTime);
        source.connect(analyserRef.current);
        source.onended = () => {
          setIsOutputPlaying(false);
          currentSourceRef.current = null;
        };
        
        currentSourceRef.current = source;
        source.start(0);
        setIsOutputPlaying(true);
      }
    } catch (err: any) {
      setStatus(prev => ({ ...prev, error: err.message || "Synthesis engine fault." }));
    } finally {
      setStatus(prev => ({ ...prev, isSynthesizing: false }));
    }
  };

  const handleExportMp3 = async () => {
    if (!generatedBuffer || !audioContextRef.current) return;
    
    const offlineCtx = new OfflineAudioContext(
      generatedBuffer.numberOfChannels,
      generatedBuffer.length / settings.rate,
      generatedBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = generatedBuffer;
    source.playbackRate.setValueAtTime(settings.rate, 0);
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = audioBufferToWav(renderedBuffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DogarStudio_VoiceMaster_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  function audioBufferToWav(buffer: AudioBuffer) {
    let numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArr = new ArrayBuffer(length),
        view = new DataView(bufferArr),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
    const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16);
    setUint32(0x61746164); setUint32(length - pos - 4);

    for(i=0; i<buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
    while(pos < length) {
      for(i=0; i<numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }
    return new Blob([bufferArr], {type: "audio/wav"});
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      initAudio();
      const source = audioContextRef.current!.createMediaStreamSource(stream);
      recorderAnalyserRef.current = audioContextRef.current!.createAnalyser();
      source.connect(recorderAnalyserRef.current);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          setClonedVoiceBase64(base64data);
        };
        stream.getTracks().forEach(track => track.stop());
        recorderAnalyserRef.current = null;
      };
      mediaRecorder.start();
      setStatus(prev => ({ ...prev, isRecording: true }));
      setRecordingSeconds(0);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds(s => { if (s >= 30) { stopRecording(); return 30; } return s + 1; });
      }, 1000);
    } catch (err) {
      setStatus(prev => ({ ...prev, error: "Input sensors unavailable." }));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setStatus(prev => ({ ...prev, isRecording: false }));
  };

  const insertTag = (tag: string) => {
    if (!textAreaRef.current) return;
    const start = textAreaRef.current.selectionStart;
    const end = textAreaRef.current.selectionEnd;
    const text = inputText;
    setInputText(text.substring(0, start) + tag + text.substring(end));
    setTimeout(() => {
      textAreaRef.current?.focus();
      const pos = start + tag.length;
      textAreaRef.current?.setSelectionRange(pos, pos);
    }, 10);
  };

  return (
    <div className="min-h-screen bg-[#020202] text-slate-100 flex flex-col items-center selection:bg-orange-500/30 font-sans antialiased overflow-x-hidden p-6 md:p-12">
      
      {/* CLONE MODAL */}
      {showRecordingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="glass-panel w-full max-w-2xl p-8 md:p-16 rounded-[4rem] border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-600 to-transparent"></div>
            <div className="flex justify-between items-center mb-10">
              <div className="flex flex-col">
                <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-orange-500 italic">Neural Signature Capture</h2>
              </div>
              <button onClick={() => { stopRecording(); setShowRecordingModal(false); }} className="p-4 hover:bg-white/5 rounded-full transition-all text-slate-600 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="bg-slate-900/40 p-12 rounded-[3rem] border border-white/5 mb-10 text-center relative">
              <p className="italic text-slate-300 text-2xl leading-relaxed font-light">"{RECORDING_SCRIPTS[settings.language]}"</p>
            </div>
            <div className="flex flex-col items-center gap-12">
              <div className="w-full h-40 bg-black/60 rounded-[3rem] border border-white/5 relative overflow-hidden">
                <canvas ref={recordCanvasRef} width="600" height="160" className="w-full h-full" />
                {!status.isRecording && !clonedVoiceBase64 && (
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.5em] text-slate-800 animate-pulse">Awaiting Signal</div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row w-full gap-6">
                <button onClick={status.isRecording ? stopRecording : startRecording} className={`flex-grow h-20 rounded-[2.5rem] font-black uppercase text-[10px] tracking-[0.4em] transition-all flex items-center justify-center gap-6 shadow-2xl ${status.isRecording ? 'bg-orange-600' : 'bg-white text-black hover:bg-slate-200'}`}>
                  <div className={`w-3 h-3 rounded-full ${status.isRecording ? 'bg-white animate-ping' : 'bg-orange-600'}`}></div>
                  {status.isRecording ? `REC ${30 - recordingSeconds}S` : 'Capture Signal'}
                </button>
                {clonedVoiceBase64 && (
                  <button onClick={() => { setSettings(s => ({...s, isCloned: true, voicePreset: 'Zephyr'})); setShowRecordingModal(false); }} className="px-12 h-20 bg-orange-600 border border-orange-500 rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest text-white hover:brightness-110 shadow-2xl shadow-orange-600/40">Apply Profile</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER - CENTERED */}
      <header className="w-full max-w-6xl py-12 flex flex-col items-center gap-12 text-center">
        <div className="flex flex-col items-center gap-6 group cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-24 h-24 bg-gradient-to-br from-orange-600 to-red-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-orange-600/30 group-hover:rotate-12 transition-all duration-700 border border-white/10">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </div>
          <div className="space-y-3">
            <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none text-white">Dogar <span className="text-orange-500">Studio</span></h1>
            <p className="text-[12px] font-bold text-slate-700 uppercase tracking-[0.7em] opacity-80">Professional Neural Mastering Complex</p>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE - CENTRALLY ALIGNED STACK */}
      <main className="w-full max-w-6xl flex flex-col gap-12 mx-auto pb-4">
        
        {/* PRIMARY TEXT AREA - HUGE CONTAINER, SMALL TEXT */}
        <div className="glass-panel p-10 md:p-14 rounded-[5rem] border border-white/5 relative flex flex-col min-h-[900px] shadow-3xl">
          <div className="flex flex-col items-center mb-14 gap-8">
            <div className="flex items-center gap-6 bg-black/40 px-8 py-3.5 rounded-full border border-white/5 flex-shrink-0">
              <div className={`w-3 h-3 rounded-full ${isOutputPlaying ? 'bg-orange-500 animate-pulse shadow-[0_0_20px_#f97316]' : 'bg-slate-900'}`}></div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-600 whitespace-nowrap">Emotions</h2>
            </div>
            <div className="flex items-center justify-center gap-6 w-full">
              <button onClick={handleRefine} disabled={status.isRefining || !inputText.trim()} className="px-8 py-4 text-[10px] font-black uppercase bg-white text-black rounded-[2rem] hover:bg-orange-600 hover:text-white transition-all disabled:opacity-30 active:scale-95 shadow-2xl whitespace-nowrap">Refine AI</button>
              <button onClick={() => setInputText('')} className="p-4 bg-red-500/5 text-red-500/20 hover:text-red-500 hover:bg-red-500/10 transition-all rounded-[2rem] active:scale-90"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-14 max-w-4xl mx-auto">
            {VOICE_SITUATIONS.map(m => (
              <button key={m.id} onClick={() => insertTag(m.tag)} className="px-8 py-6 rounded-[2.5rem] bg-slate-950/50 border border-white/5 text-[10px] font-bold text-slate-700 hover:text-white hover:border-orange-500/40 hover:bg-slate-900 transition-all active:scale-95 flex items-center gap-4">
                <span className="text-lg opacity-80">{m.icon}</span> {m.label}
              </button>
            ))}
          </div>

          <textarea
            ref={textAreaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Inject narrative sequence for neural synthesis..."
            className="flex-grow bg-transparent border-none p-0 text-slate-100 placeholder-slate-900 focus:outline-none resize-none text-xl md:text-2xl leading-relaxed font-normal custom-scrollbar selection:bg-orange-600/30 italic"
          />

          {/* COUNTER SECTION - CENTERED BELOW TEXTAREA */}
          <div className="flex justify-center gap-12 mt-10 pt-10 border-t border-white/5 text-[10px] font-black uppercase tracking-[0.6em] text-slate-800 italic">
            <div className="flex flex-col items-center gap-2">
              <span className="text-orange-500/60 font-mono tracking-widest">{inputText.length}</span>
              <span>Characters</span>
            </div>
            <div className="w-px h-12 bg-slate-950"></div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-orange-500/60 font-mono tracking-widest">{inputText.trim() ? inputText.trim().split(/\s+/).length : 0}</span>
              <span>Words</span>
            </div>
          </div>
        </div>

        {/* SETTINGS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* VOICE & LOCALE */}
          <div className="glass-panel p-12 rounded-[4rem] border border-white/5 space-y-12 shadow-2xl flex flex-col items-center">
            <div className="w-full space-y-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.7em] text-slate-800 italic flex items-center justify-center gap-6">
                <span className="w-12 h-px bg-slate-900"></span> Voice Identity
              </h3>
              <div className="flex flex-wrap justify-center gap-5">
                {VOICES.map(v => (
                  <button 
                    key={v.id} 
                    onClick={() => setSettings(s => ({...s, isCloned: false, voicePreset: v.id}))} 
                    className={`w-32 py-5 rounded-[2rem] border transition-all flex flex-col items-center justify-center gap-1 ${settings.voicePreset === v.id && !settings.isCloned ? 'bg-slate-100 text-black border-white shadow-2xl scale-[1.1]' : 'bg-slate-950 border-slate-900 text-slate-800 hover:border-slate-800'}`}
                  >
                    <span className="text-[10px] font-black uppercase">{v.id}</span>
                    <span className={`text-[8px] font-bold uppercase tracking-widest ${settings.voicePreset === v.id && !settings.isCloned ? 'text-slate-500' : 'text-slate-800'}`}>{v.gender}</span>
                  </button>
                ))}
                {clonedVoiceBase64 && (
                  <button onClick={() => setSettings(s => ({...s, isCloned: true, voicePreset: 'Custom Voice Cloner'}))} className={`w-full py-8 rounded-[2rem] text-[10px] font-black uppercase border transition-all flex items-center justify-center gap-6 ${settings.isCloned ? 'bg-orange-600 text-white border-orange-500 shadow-2xl scale-[1.02]' : 'bg-slate-950 border-slate-900 text-orange-600/60 hover:bg-slate-900'}`}>
                    <span className="w-3 h-3 bg-current rounded-full animate-pulse"></span>
                    Custom Neural Profile
                  </button>
                )}
              </div>
            </div>

            <div className="w-full space-y-8 mt-4">
               <h3 className="text-[10px] font-black uppercase tracking-[0.7em] text-slate-800 italic flex items-center justify-center gap-6">
                 <span className="w-12 h-px bg-slate-900"></span> Signal Locale
               </h3>
               <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-6 custom-scrollbar">
                  {(Object.entries(LanguageLabels) as [Language, string][]).map(([code, label]) => (
                    <button key={code} onClick={() => setSettings(s => ({...s, language: code}))} className={`text-center px-6 py-5 rounded-[2rem] text-[10px] font-black border transition-all ${settings.language === code ? 'bg-orange-600 border-orange-500 text-white shadow-2xl' : 'bg-slate-950 border-slate-900 text-slate-900 hover:border-slate-800'}`}>
                      {label}
                    </button>
                  ))}
               </div>
            </div>
          </div>

          {/* PERFORMANCE CONTROLS */}
          <div className="glass-panel p-12 rounded-[4rem] border border-white/5 space-y-12 shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.7em] text-slate-800 italic flex items-center gap-6">
              <span className="w-12 h-px bg-slate-900"></span> Master Modulation
            </h3>
            <div className="space-y-16 py-8">
              {[
                { label: 'Gain Intensity', key: 'volume', min: 0, max: 1, step: 0.01, val: (settings.volume*100).toFixed(0)+'%' },
                { label: 'Neural Cadence', key: 'rate', min: 0.5, max: 2, step: 0.1, val: settings.rate+'x' },
                { label: 'Spectral Pitch', key: 'pitch', min: 0.5, max: 1.5, step: 0.1, val: settings.pitch.toFixed(1) }
              ].map(ctrl => (
                <div key={ctrl.key} className="space-y-8">
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-900 tracking-[0.5em] px-3">
                    <label>{ctrl.label}</label>
                    <span className="text-orange-500 font-mono italic">{ctrl.val}</span>
                  </div>
                  <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step} value={(settings as any)[ctrl.key]} onChange={(e) => setSettings(s => ({...s, [ctrl.key]: parseFloat(e.target.value)}))} className="w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FINAL EXECUTION PANEL */}
        <div className="flex flex-col gap-10 mt-12 items-center">
          <div className="flex w-full">
            <button 
              onClick={handleSpeak} 
              disabled={status.isSynthesizing} 
              className={`w-full h-32 rounded-[3.5rem] font-black uppercase text-4xl tracking-[0.4em] italic flex items-center justify-center transition-all shadow-2xl active:scale-[0.98] relative overflow-hidden group ${status.isSynthesizing ? 'bg-slate-950 text-slate-800' : 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:brightness-110 shadow-orange-600/30'}`}
            >
              {status.isSynthesizing ? (
                <span className="flex items-center gap-6 text-2xl">
                  <svg className="animate-spin h-10 w-10 text-slate-700" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Generating...
                </span>
              ) : 'Generate'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-8 w-full justify-center">
            {generatedBuffer && (
              <button onClick={handleExportMp3} className="flex-grow h-32 bg-white text-black font-black uppercase text-4xl tracking-[0.4em] rounded-[3rem] hover:bg-slate-100 transition-all shadow-3xl active:scale-[0.99] animate-in slide-in-from-bottom-12 italic">
                Download
              </button>
            )}
          </div>

          {status.error && (
            <div className="w-full bg-red-950/30 border-2 border-red-500/20 text-red-400 p-12 rounded-[4rem] text-[10px] font-black uppercase tracking-[0.6em] flex justify-between items-center animate-in zoom-in-95 shadow-4xl">
              <div className="flex items-center gap-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                {status.error}
              </div>
              <button onClick={() => setStatus(s => ({...s, error: null}))} className="p-4 hover:text-white transition-colors">&times;</button>
            </div>
          )}

          {/* FREQUENCY MONITOR - END OF PAGE */}
          <div className="glass-panel p-10 md:p-14 rounded-[4rem] border border-white/5 flex flex-col items-center gap-12 shadow-2xl w-full mt-10">
             <div className="w-full">
               <div className="flex justify-between mb-6 px-3">
                 <span className="text-[10px] font-black uppercase text-slate-800 tracking-[0.6em] italic">Frequency Monitor</span>
                 <span className="text-[10px] font-mono text-orange-500/60 tracking-[0.2em] uppercase">{isOutputPlaying ? 'Signal Active' : 'Standby'}</span>
               </div>
               <div className="h-32 w-full bg-black/60 rounded-[2rem] border border-white/5 overflow-hidden flex items-end shadow-inner">
                 <canvas ref={canvasRef} width="1000" height="128" className="w-full h-full" />
               </div>
             </div>
          </div>

          {/* ARCHITECT CREDIT SECTION */}
          <div className="pt-8 pb-8 flex flex-col items-center gap-8 border-t border-white/5 w-full">
            <div className="flex gap-16 items-center">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.7em] mb-4 italic">Architect</span>
                <span className="text-xl font-black text-slate-400 uppercase italic tracking-tighter">Adnan Dogar</span>
              </div>
              <div className="w-px h-16 bg-slate-900"></div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.7em] mb-4 italic">Signal Integrity</span>
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 bg-orange-600 rounded-full animate-pulse shadow-[0_0_15px_#ea580c]"></div>
                  <span className="text-[12px] font-mono text-slate-700 font-bold uppercase tracking-widest">100% Locked</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
