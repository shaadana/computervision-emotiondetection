import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Camera,
  Mic,
  MicOff,
  Video,
  Square,
  Image,
  Download,
  MessageCircle,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  Phone,
  PhoneOff,
  BarChart3,
} from 'lucide-react';
import './styles.css';

const emotions = ['Warmth', 'Focus', 'Confidence', 'Calm', 'Energy'];
const facialEmotions = ['Joy', 'Surprise', 'Concern', 'Neutrality', 'Engagement'];
const contortionMetrics = ['Brow tension', 'Mouth openness', 'Asymmetry', 'Cheek lift', 'Jaw set'];

const prompts = [
  'Introduce yourself for a role you care about.',
  'Explain a recent project in sixty seconds.',
  'Practice answering: what makes you a strong collaborator?',
  'Describe a challenge and how you handled it.',
];

const callPrompts = [
  'Tell me about yourself as if we just met at a professional event.',
  'What is a recent accomplishment you are proud of, and why did it matter?',
  'Describe a moment when you had to communicate under pressure.',
  'What kind of impression do you want to leave after this conversation?',
];

const conversationSystem = `You are a thoughtful conversation partner in a practice video call, not a performance reviewer.
Keep the call flowing naturally. Reply to the substance of what the user said, add one brief human observation or related thought, then ask exactly one follow-up question.
Do not list tips, do not score them, do not mention delivery metrics, and do not lecture. Keep the response under 45 words.`;

const defaultOllamaModel = 'llama3.1';
const defaultTransformersModel = 'HuggingFaceTB/SmolLM2-135M-Instruct';
const ollamaEndpoint = 'http://127.0.0.1:11434/api/generate';

function analyzeContent(text) {
  const words = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
  const fillerWords = words.filter((word) => ['um', 'uh', 'like', 'so', 'basically', 'actually'].includes(word)).length;
  const confidentWords = words.filter((word) => ['led', 'built', 'decided', 'improved', 'created', 'learned', 'delivered'].includes(word)).length;
  const questionCount = (text.match(/\?/g) || []).length;
  const sentenceCount = Math.max((text.match(/[.!?]/g) || []).length, 1);
  const substance = clamp(words.length * 1.3 + confidentWords * 8 - fillerWords * 4);
  const structure = clamp(62 + Math.min(sentenceCount, 8) * 5 - fillerWords * 3);
  const curiosity = clamp(45 + questionCount * 14);
  return { fillerWords, confidentWords, substance, structure, curiosity };
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function pct(value) {
  return `${Math.round(value)}%`;
}

function useCameraAnalysis(videoRef, canvasRef, active) {
  const [stats, setStats] = useState({
    Warmth: 54,
    Focus: 64,
    Confidence: 58,
    Calm: 68,
    Energy: 51,
  });
  const [faceStats, setFaceStats] = useState({
    emotions: {
      Joy: 46,
      Surprise: 28,
      Concern: 22,
      Neutrality: 58,
      Engagement: 54,
    },
    contortions: {
      'Brow tension': 31,
      'Mouth openness': 24,
      Asymmetry: 18,
      'Cheek lift': 42,
      'Jaw set': 36,
    },
  });
  const [summary, setSummary] = useState('Start the camera to build a live expression profile.');

  useEffect(() => {
    if (!active) return undefined;
    let frame;
    const ctx = canvasRef.current?.getContext('2d');

    const analyze = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !ctx || video.readyState < 2) {
        frame = requestAnimationFrame(analyze);
        return;
      }

      canvas.width = 160;
      canvas.height = 120;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let brightness = 0;
      let warmth = 0;
      let contrast = 0;
      let samples = 0;
      let upperBrightness = 0;
      let midBrightness = 0;
      let lowerBrightness = 0;
      let leftBrightness = 0;
      let rightBrightness = 0;
      let upperSamples = 0;
      let midSamples = 0;
      let lowerSamples = 0;
      let sideSamples = 0;

      for (let y = 24; y < 102; y += 4) {
        for (let x = 38; x < 124; x += 4) {
          const i = (y * canvas.width + x) * 4;
          const r = image[i];
          const g = image[i + 1];
          const b = image[i + 2];
          const avg = (r + g + b) / 3;
          brightness += avg;
          warmth += r - b;
          contrast += Math.abs(avg - 128);
          if (y < 48) {
            upperBrightness += avg;
            upperSamples += 1;
          } else if (y < 74) {
            midBrightness += avg;
            midSamples += 1;
          } else {
            lowerBrightness += avg;
            lowerSamples += 1;
          }
          if (x < 82) {
            leftBrightness += avg;
          } else {
            rightBrightness += avg;
          }
          sideSamples += 1;
          samples += 1;
        }
      }

      const bright = brightness / samples;
      const warm = warmth / samples;
      const movement = contrast / samples;
      const upper = upperBrightness / upperSamples;
      const mid = midBrightness / midSamples;
      const lower = lowerBrightness / lowerSamples;
      const left = leftBrightness / Math.max(sideSamples / 2, 1);
      const right = rightBrightness / Math.max(sideSamples / 2, 1);
      const asymmetry = Math.abs(left - right);
      const mouthLift = clamp((lower - mid + 18) * 2.1);
      const browTension = clamp((upper - mid + movement * 0.9 + 18) * 1.6);
      const mouthOpenness = clamp((Math.abs(lower - mid) + movement * 0.55) * 2.2);
      const cheekLift = clamp((warm * 0.9 + lower - upper + 28) * 1.35);
      const jawSet = clamp((movement * 1.45 + Math.abs(lower - bright) * 0.9));
      const next = {
        Warmth: clamp(48 + warm * 0.7 + bright * 0.05),
        Focus: clamp(88 - Math.abs(bright - 128) * 0.38),
        Confidence: clamp(42 + movement * 1.4 + bright * 0.08),
        Calm: clamp(84 - movement * 1.2),
        Energy: clamp(34 + movement * 1.8 + warm * 0.22),
      };
      const nextFaceStats = {
        emotions: {
          Joy: clamp(38 + cheekLift * 0.42 + mouthLift * 0.24 + warm * 0.25),
          Surprise: clamp(18 + mouthOpenness * 0.48 + browTension * 0.25),
          Concern: clamp(16 + browTension * 0.42 + jawSet * 0.24 - cheekLift * 0.12),
          Neutrality: clamp(82 - mouthOpenness * 0.32 - browTension * 0.22 - asymmetry * 0.75),
          Engagement: clamp(42 + movement * 0.85 + cheekLift * 0.25 + next.Focus * 0.18),
        },
        contortions: {
          'Brow tension': browTension,
          'Mouth openness': mouthOpenness,
          Asymmetry: clamp(asymmetry * 5.6),
          'Cheek lift': cheekLift,
          'Jaw set': jawSet,
        },
      };

      setStats((current) =>
        Object.fromEntries(
          emotions.map((emotion) => [emotion, current[emotion] * 0.82 + next[emotion] * 0.18]),
        ),
      );
      setFaceStats((current) => ({
        emotions: Object.fromEntries(
          facialEmotions.map((emotion) => [
            emotion,
            current.emotions[emotion] * 0.82 + nextFaceStats.emotions[emotion] * 0.18,
          ]),
        ),
        contortions: Object.fromEntries(
          contortionMetrics.map((metric) => [
            metric,
            current.contortions[metric] * 0.82 + nextFaceStats.contortions[metric] * 0.18,
          ]),
        ),
      }));
      frame = requestAnimationFrame(analyze);
    };

    frame = requestAnimationFrame(analyze);
    return () => cancelAnimationFrame(frame);
  }, [active, canvasRef, videoRef]);

  useEffect(() => {
    const strongest = emotions.reduce((a, b) => (stats[a] > stats[b] ? a : b));
    const lowest = emotions.reduce((a, b) => (stats[a] < stats[b] ? a : b));
    setSummary(`${strongest} is leading right now, while ${lowest.toLowerCase()} has room to rise.`);
  }, [stats]);

  return { stats, faceStats, summary };
}

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const coachReplyTimerRef = useRef(null);
  const transformersPipeRef = useRef(null);
  const transformersModelRef = useRef('');
  const [stream, setStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [breakdownUrl, setBreakdownUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [transcript, setTranscript] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [speechStarted, setSpeechStarted] = useState(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const [page, setPage] = useState('studio');
  const [callActive, setCallActive] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [callTranscript, setCallTranscript] = useState('');
  const [conversationTurns, setConversationTurns] = useState([]);
  const [coachReply, setCoachReply] = useState('Start the call to hear the coach ask the first question.');
  const [coachStatus, setCoachStatus] = useState('Ollama local model ready when your server is running.');
  const [coachProvider, setCoachProvider] = useState('ollama');
  const [ollamaModel, setOllamaModel] = useState(defaultOllamaModel);
  const [transformersModel, setTransformersModel] = useState(defaultTransformersModel);
  const [callPromptIndex, setCallPromptIndex] = useState(0);
  const [callStarted, setCallStarted] = useState(null);
  const { stats, faceStats, summary } = useCameraAnalysis(videoRef, canvasRef, cameraOn);

  const average = useMemo(
    () => emotions.reduce((total, emotion) => total + stats[emotion], 0) / emotions.length,
    [stats],
  );

  const wordsPerMinute = useMemo(() => {
    if (!speechStarted || !wordCount) return 0;
    const minutes = Math.max((Date.now() - speechStarted) / 60000, 0.15);
    return Math.round(wordCount / minutes);
  }, [speechStarted, wordCount, transcript]);

  const voiceStats = useMemo(() => {
    const paceScore = clamp(100 - Math.abs(wordsPerMinute - 145) * 0.65);
    const confidence = clamp((stats.Confidence * 0.58 + paceScore * 0.42));
    const clarity = clamp((stats.Focus * 0.45 + paceScore * 0.4 + stats.Calm * 0.15));
    const presence = clamp((average * 0.55 + confidence * 0.45));
    return { paceScore, confidence, clarity, presence };
  }, [average, stats, wordsPerMinute]);

  const callContent = useMemo(() => analyzeContent(callTranscript), [callTranscript]);
  const callWords = useMemo(
    () => callTranscript.trim().split(/\s+/).filter(Boolean).length,
    [callTranscript],
  );
  const callWpm = useMemo(() => {
    if (!callStarted || !callWords) return 0;
    return Math.round(callWords / Math.max((Date.now() - callStarted) / 60000, 0.15));
  }, [callStarted, callWords, callTranscript]);
  const callConfidence = useMemo(
    () => clamp(stats.Confidence * 0.5 + voiceStats.confidence * 0.25 + callContent.substance * 0.25),
    [callContent.substance, stats.Confidence, voiceStats.confidence],
  );
  const dominantFacialEmotion = useMemo(
    () => facialEmotions.reduce((a, b) => (faceStats.emotions[a] > faceStats.emotions[b] ? a : b)),
    [faceStats],
  );
  const strongestContortion = useMemo(
    () => contortionMetrics.reduce((a, b) => (faceStats.contortions[a] > faceStats.contortions[b] ? a : b)),
    [faceStats],
  );

  async function startCamera() {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(media);
      if (videoRef.current) videoRef.current.srcObject = media;
      setCameraOn(true);
      setNotice('');
    } catch {
      setNotice('Camera or microphone permission was blocked. Allow access to start live analysis.');
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setCameraOn(false);
    setMicOn(false);
    setRecording(false);
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    setSnapshotUrl(canvas.toDataURL('image/png'));
  }

  function takeBreakdownSnapshot() {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff4e8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3f2a1e';
    ctx.font = '42px Georgia';
    ctx.fillText('Expression Breakdown', 56, 82);
    ctx.font = '24px Georgia';
    ctx.fillText(summary, 56, 126);
    emotions.forEach((emotion, index) => {
      const y = 190 + index * 78;
      ctx.fillStyle = '#6b4a34';
      ctx.fillText(emotion, 56, y);
      ctx.fillStyle = '#f3c08f';
      ctx.fillRect(240, y - 28, 560, 34);
      ctx.fillStyle = '#e8874f';
      ctx.fillRect(240, y - 28, 560 * (stats[emotion] / 100), 34);
      ctx.fillStyle = '#3f2a1e';
      ctx.fillText(pct(stats[emotion]), 835, y);
    });
    setBreakdownUrl(canvas.toDataURL('image/png'));
  }

  function toggleRecording() {
    if (!stream) return;
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setVideoUrl(URL.createObjectURL(blob));
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  }

  function toggleSpeech() {
    if (micOn) {
      recognitionRef.current?.stop();
      setMicOn(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechStarted(Date.now());
    setTranscript('');
    setWordCount(0);
    if (!SpeechRecognition) {
      setTranscript('Speech recognition is unavailable in this browser, but voice pacing will activate when supported.');
      setMicOn(true);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(' ');
      setTranscript(text);
      setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
    };
    recognition.onend = () => setMicOn(false);
    recognition.start();
    recognitionRef.current = recognition;
    setMicOn(true);
  }

  function speakCoach(text) {
    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 0.92;
    window.speechSynthesis?.speak(utterance);
  }

  function extractTopic(text) {
    const words = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
    const stopWords = new Set(['the', 'and', 'that', 'this', 'with', 'for', 'you', 'your', 'was', 'were', 'are', 'have', 'had', 'about', 'from', 'into', 'when', 'what', 'how', 'why', 'did', 'does', 'but', 'not', 'they', 'them', 'there', 'then', 'than', 'just', 'like', 'because']);
    const candidates = words.filter((word) => word.length > 4 && !stopWords.has(word));
    return candidates.at(-1) || candidates[0] || 'that experience';
  }

  function buildCoachReply(text) {
    const content = analyzeContent(text);
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const topic = extractTopic(text);
    if (words < 8) {
      return `I heard you mention ${topic}. That sounds like there is more behind it. What made that stand out to you?`;
    }
    if (content.fillerWords > 3) {
      return `The part about ${topic} is interesting. It sounds like there may have been a lot happening at once. What was the hardest part to explain or handle?`;
    }
    if (content.confidentWords < 1) {
      return `I am curious about your role in ${topic}. What did you personally do that shaped the outcome?`;
    }
    if (content.curiosity < 55) {
      return `That gives me a clearer picture of ${topic}. How did that experience change the way you approach similar situations now?`;
    }
    return `That is a useful example, especially the way you framed ${topic}. What did that experience teach you about how you work with people?`;
  }

  async function askOllama(userText) {
    const prompt = buildCoachPrompt(userText);

    const response = await fetch(ollamaEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel.trim() || defaultOllamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.75,
          num_predict: 90,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const data = await response.json();
    return data.response?.trim() || buildCoachReply(userText);
  }

  function buildCoachPrompt(userText) {
    const content = analyzeContent(userText);
    const topic = extractTopic(userText);
    return `${conversationSystem}

User's latest message: "${userText}"

Private context you may use silently:
- likely topic: ${topic}
- user appears ${stats.Calm > 65 ? 'fairly calm' : 'a little tense'}
- filler words: ${content.fillerWords}
- content substance score: ${Math.round(content.substance)}%

Respond only with what you would say next in the call.`;
  }

  function cleanGeneratedReply(generatedText, prompt) {
    const cleaned = generatedText
      .replace(prompt, '')
      .replace(/<\/?s>|<\|.*?\|>/g, '')
      .replace(/^assistant[:\s-]*/i, '')
      .trim()
      .split('\n')
      .filter(Boolean)
      .slice(0, 2)
      .join(' ')
      || '';
    const sentences = cleaned.match(/[^.!?]+[.!?]+/g);
    return (sentences ? sentences.slice(0, 2).join(' ') : cleaned).slice(0, 320).trim();
  }

  async function askTransformers(userText) {
    const model = transformersModel.trim() || defaultTransformersModel;
    if (!transformersPipeRef.current || transformersModelRef.current !== model) {
      const { pipeline } = await import('@huggingface/transformers');
      transformersPipeRef.current = await pipeline('text-generation', model);
      transformersModelRef.current = model;
    }

    const prompt = buildCoachPrompt(userText);
    const output = await transformersPipeRef.current(prompt, {
      max_new_tokens: 80,
      temperature: 0.75,
      do_sample: true,
      return_full_text: false,
    });
    const generated = Array.isArray(output) ? output[0]?.generated_text : output?.generated_text;
    return cleanGeneratedReply(generated || '', prompt) || buildCoachReply(userText);
  }

  async function askSelectedCoach(userText) {
    if (coachProvider === 'transformers') {
      return askTransformers(userText);
    }
    return askOllama(userText);
  }

  function providerLabel() {
    if (coachProvider === 'transformers') {
      return `Transformers.js model: ${transformersModel.trim() || defaultTransformersModel}`;
    }
    return `Ollama model: ${ollamaModel.trim() || defaultOllamaModel}`;
  }

  async function startPracticeCall() {
    if (!cameraOn) await startCamera();
    setCallActive(true);
    setCallEnded(false);
    setCallTranscript('');
    setConversationTurns([]);
    setCallStarted(Date.now());
    setCoachStatus(`Using ${providerLabel()}`);
    const opening = callPrompts[callPromptIndex];
    setCoachReply(opening);
    setConversationTurns([{ speaker: 'AI', text: opening }]);
    speakCoach(opening);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setCallTranscript('Speech recognition is unavailable in this browser. You can still use the visual practice format and end the call for expression analysis.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(' ');
      setCallTranscript(text);
      const latest = event.results[event.results.length - 1];
      if (latest?.isFinal) {
        const userUtterance = latest[0]?.transcript?.trim();
        if (userUtterance) {
          setConversationTurns((turns) => [...turns, { speaker: 'You', text: userUtterance }]);
        }
        window.clearTimeout(coachReplyTimerRef.current);
        coachReplyTimerRef.current = window.setTimeout(async () => {
          setCoachStatus(`Thinking with ${providerLabel()}`);
          try {
            const reply = await askSelectedCoach(text);
            setCoachReply(reply);
            setConversationTurns((turns) => [...turns, { speaker: 'AI', text: reply }]);
            setCoachStatus(`Using ${providerLabel()}`);
            speakCoach(reply);
          } catch {
            const reply = buildCoachReply(text);
            setCoachReply(reply);
            setConversationTurns((turns) => [...turns, { speaker: 'AI', text: reply }]);
            setCoachStatus(`${coachProvider === 'transformers' ? 'Transformers.js' : 'Ollama'} was not reachable, so the local fallback coach responded.`);
            speakCoach(reply);
          }
        }, 1000);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  function endPracticeCall() {
    recognitionRef.current?.stop();
    window.clearTimeout(coachReplyTimerRef.current);
    window.speechSynthesis?.cancel();
    setCallActive(false);
    setCallEnded(true);
    setCoachStatus(`Using ${providerLabel()}`);
  }

  function nextCoachPrompt() {
    const next = (callPromptIndex + 1) % callPrompts.length;
    setCallPromptIndex(next);
    setCoachReply(callPrompts[next]);
    setConversationTurns((turns) => [...turns, { speaker: 'AI', text: callPrompts[next] }]);
    speakCoach(callPrompts[next]);
  }

  const coaching = average > 72
    ? 'Your delivery reads composed and expressive. Keep the pace steady and leave deliberate pauses after key points.'
    : 'Your delivery is still settling. Lift eye-line consistency, slow the first sentence, and add a clearer smile cue before transitions.';

  return (
    <main className="app">
      <div className="shape shape-one" />
      <div className="shape shape-two" />
      <div className="shape shape-three" />
      <header className="topbar">
        <div>
          <p className="eyebrow">Computer vision practice room</p>
          <h1>Expression Studio</h1>
        </div>
        <div className="topActions">
          <button className={page === 'studio' ? 'primary' : 'secondary'} onClick={() => setPage('studio')}>
            <BarChart3 size={18} />Studio
          </button>
          <button className={page === 'call' ? 'primary' : 'secondary'} onClick={() => setPage('call')}>
            <Phone size={18} />Practice call
          </button>
          <button className="primary" onClick={cameraOn ? stopCamera : startCamera}>
            {cameraOn ? <Pause size={18} /> : <Play size={18} />}
            {cameraOn ? 'Stop session' : 'Start session'}
          </button>
        </div>
      </header>

      {page === 'studio' ? <section className="workspace">
        <div className="cameraPanel">
          <div className="videoShell">
            <video ref={videoRef} autoPlay muted playsInline />
            {!cameraOn && (
              <div className="cameraEmpty">
                <Camera size={44} />
                <span>Camera preview</span>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} hidden />
          {notice && <p className="notice">{notice}</p>}
          <div className="controls">
            <button onClick={takePhoto} disabled={!cameraOn}><Image size={18} />Photo</button>
            <button onClick={toggleRecording} disabled={!cameraOn}>
              {recording ? <Square size={18} /> : <Video size={18} />}
              {recording ? 'Stop video' : 'Record'}
            </button>
            <button onClick={takeBreakdownSnapshot}><Download size={18} />Breakdown</button>
            <button onClick={toggleSpeech}>{micOn ? <MicOff size={18} /> : <Mic size={18} />}{micOn ? 'Listening' : 'Speak'}</button>
          </div>
        </div>

        <div className="statsPanel">
          <div className="scoreRing">
            <span>{pct(average)}</span>
            <small>overall presence</small>
          </div>
          <p className="summary">{summary}</p>
          <div className="bars">
            {emotions.map((emotion) => (
              <div className="barRow" key={emotion}>
                <div className="barLabel"><span>{emotion}</span><strong>{pct(stats[emotion])}</strong></div>
                <div className="barTrack"><div style={{ width: `${stats[emotion]}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </section> : (
        <section className="callPage">
          <div className="callStage">
            <div className="videoShell callVideo">
              <video ref={videoRef} autoPlay muted playsInline />
              {!cameraOn && (
                <div className="cameraEmpty">
                  <Camera size={44} />
                  <span>Camera preview</span>
                </div>
              )}
            </div>
            <div className="coachTile">
              <MessageCircle size={42} />
              <h2>Classical conversation coach</h2>
              <p>{coachReply}</p>
            </div>
          </div>
          <canvas ref={canvasRef} hidden />
          {notice && <p className="notice centeredNotice">{notice}</p>}
          <div className="callControls">
            <label className="modelField">
              <span>AI provider</span>
              <select value={coachProvider} onChange={(event) => setCoachProvider(event.target.value)} disabled={callActive}>
                <option value="ollama">Ollama</option>
                <option value="transformers">Transformers.js</option>
              </select>
            </label>
            <label className="modelField wideModelField">
              <span>{coachProvider === 'transformers' ? 'Transformers.js model' : 'Ollama model'}</span>
              <input
                value={coachProvider === 'transformers' ? transformersModel : ollamaModel}
                onChange={(event) => {
                  if (coachProvider === 'transformers') {
                    setTransformersModel(event.target.value);
                  } else {
                    setOllamaModel(event.target.value);
                  }
                }}
                placeholder={coachProvider === 'transformers' ? defaultTransformersModel : defaultOllamaModel}
                disabled={callActive}
              />
            </label>
            <button className="primary" onClick={callActive ? endPracticeCall : startPracticeCall}>
              {callActive ? <PhoneOff size={18} /> : <Phone size={18} />}
              {callActive ? 'End call' : 'Start call'}
            </button>
            <button className="secondary" onClick={nextCoachPrompt} disabled={!callActive}>
              <RefreshCw size={17} />Next question
            </button>
          </div>
          <p className="modelStatus">{coachStatus}</p>
          <div className="callGrid">
            <article className="panel">
              <h2><Mic size={21} />Conversation</h2>
              <div className="conversationLog">
                {conversationTurns.length ? conversationTurns.slice(-6).map((turn, index) => (
                  <p className={turn.speaker === 'AI' ? 'aiTurn' : 'userTurn'} key={`${turn.speaker}-${index}`}>
                    <strong>{turn.speaker}</strong>
                    <span>{turn.text}</span>
                  </p>
                )) : <p className="transcript">Start the call and respond out loud. Your exchange will appear here.</p>}
              </div>
              <h2><Mic size={21} />Live transcript</h2>
              <p className="transcript">{callTranscript || 'Start the call and respond out loud. Your words will appear here when speech recognition is available.'}</p>
            </article>
            <article className="panel">
              <h2><BarChart3 size={21} />Call analysis</h2>
              <div className="metricGrid">
                <Metric label="Voice confidence" value={callConfidence} />
                <Metric label="Content substance" value={callContent.substance} />
                <Metric label="Structure" value={callContent.structure} />
                <Metric label="Word speed" text={`${callWpm} wpm`} value={clamp(100 - Math.abs(callWpm - 145) * 0.65)} />
              </div>
            </article>
            <article className="panel">
              <h2><Sparkles size={21} />After-call notes</h2>
              {callEnded ? (
                <p className="summary">Your strongest signal was {emotions.reduce((a, b) => (stats[a] > stats[b] ? a : b)).toLowerCase()}. You used {callContent.fillerWords} filler words and {callContent.confidentWords} action-oriented words. Aim for a measured pace, a clear opening claim, and one follow-up question.</p>
              ) : (
                <p className="summary">End the call to receive a combined review of voice, content, confidence, and expression analysis.</p>
              )}
              <div className="bars">
                {emotions.map((emotion) => (
                  <div className="barRow" key={emotion}>
                    <div className="barLabel"><span>{emotion}</span><strong>{pct(stats[emotion])}</strong></div>
                    <div className="barTrack"><div style={{ width: `${stats[emotion]}%` }} /></div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      )}

      {page === 'studio' && <section className="grid">
        <article className="panel expressionPanel">
          <h2><Sparkles size={21} />Facial emotion map</h2>
          <p className="summary">Dominant facial read: {dominantFacialEmotion.toLowerCase()}.</p>
          <div className="bars">
            {facialEmotions.map((emotion) => (
              <div className="barRow" key={emotion}>
                <div className="barLabel"><span>{emotion}</span><strong>{pct(faceStats.emotions[emotion])}</strong></div>
                <div className="barTrack emotionTrack"><div style={{ width: `${faceStats.emotions[emotion]}%` }} /></div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel expressionPanel">
          <h2><Camera size={21} />Face contortion</h2>
          <p className="summary">Strongest muscular signal: {strongestContortion.toLowerCase()}.</p>
          <div className="contortionGrid">
            {contortionMetrics.map((metric) => (
              <Metric label={metric} value={faceStats.contortions[metric]} key={metric} />
            ))}
          </div>
        </article>

        <article className="panel">
          <h2><Mic size={21} />Voice breakdown</h2>
          <div className="metricGrid">
            <Metric label="Confidence" value={voiceStats.confidence} />
            <Metric label="Clarity" value={voiceStats.clarity} />
            <Metric label="Expression" value={stats.Warmth} />
            <Metric label="Word speed" text={`${wordsPerMinute} wpm`} value={voiceStats.paceScore} />
          </div>
          <p className="transcript">{transcript || 'Press Speak and talk naturally to see pacing and transcript feedback.'}</p>
        </article>

        <article className="panel practice">
          <h2><MessageCircle size={21} />Conversation practice</h2>
          <p className="prompt">{prompts[promptIndex]}</p>
          <p>{coaching}</p>
          <button className="secondary" onClick={() => setPromptIndex((promptIndex + 1) % prompts.length)}>
            <RefreshCw size={17} />New prompt
          </button>
        </article>

        <article className="panel captures">
          <h2><Sparkles size={21} />Captures</h2>
          <div className="captureGrid">
            {snapshotUrl ? <img src={snapshotUrl} alt="Camera snapshot" /> : <span>Photo snapshots appear here.</span>}
            {breakdownUrl ? <img src={breakdownUrl} alt="Emotion breakdown snapshot" /> : <span>Breakdown snapshots appear here.</span>}
          </div>
          <div className="downloadRow">
            {snapshotUrl && <a href={snapshotUrl} download="expression-photo.png">Download photo</a>}
            {breakdownUrl && <a href={breakdownUrl} download="emotion-breakdown.png">Download breakdown</a>}
            {videoUrl && <a href={videoUrl} download="practice-video.webm">Download video</a>}
          </div>
          {videoUrl && <video className="recording" src={videoUrl} controls />}
        </article>
      </section>}
    </main>
  );
}

function Metric({ label, value, text }) {
  return (
    <div className="metric">
      <strong>{text || pct(value)}</strong>
      <span>{label}</span>
      <div className="miniTrack"><div style={{ width: `${clamp(value)}%` }} /></div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
