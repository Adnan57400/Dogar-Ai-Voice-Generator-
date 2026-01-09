
export enum Language {
  ENGLISH = 'en-US',
  URDU = 'ur-PK',
  HINDI = 'hi-IN',
  ARABIC = 'ar-SA',
  SPANISH = 'es-ES',
  FRENCH = 'fr-FR',
  GERMAN = 'de-DE',
  CHINESE = 'zh-CN',
  JAPANESE = 'ja-JP',
  PORTUGUESE = 'pt-BR',
  RUSSIAN = 'ru-RU',
  TURKISH = 'tr-TR'
}

export const LanguageLabels: Record<Language, string> = {
  [Language.ENGLISH]: 'English (US)',
  [Language.URDU]: 'Urdu (پاکستان)',
  [Language.HINDI]: 'Hindi (हिन्दी)',
  [Language.ARABIC]: 'Arabic (العربية)',
  [Language.SPANISH]: 'Spanish (Español)',
  [Language.FRENCH]: 'French (Français)',
  [Language.GERMAN]: 'German (Deutsch)',
  [Language.CHINESE]: 'Chinese (中文)',
  [Language.JAPANESE]: 'Japanese (日本語)',
  [Language.PORTUGUESE]: 'Portuguese (Português)',
  [Language.RUSSIAN]: 'Russian (Русский)',
  [Language.TURKISH]: 'Turkish (Türkçe)'
};

export const RECORDING_SCRIPTS: Record<Language, string> = {
  [Language.ENGLISH]: "The quick brown fox jumps over the lazy dog. Voice synthesis is the future of communication, and I am training my personal neural profile to speak for me.",
  [Language.URDU]: "مصنوعی ذہانت مواصلات کا مستقبل ہے، اور میں اپنا ذاتی آواز کا پروفائل تربیت دے رہا ہوں۔",
  [Language.HINDI]: "आर्टिफिशियल इंटेलिजेंस संचार का भविष्य है, और मैं बोलने के लिए अपना व्यक्तिगत आवाज़ प्रोफ़ाइल तैयार कर रहा हूँ।",
  [Language.ARABIC]: "الذكاء الاصطناعي هو مستقبل الاتصال، وأنا أقوم بتدريب ملف صوتي شخصي للتحدث نيابة عني.",
  [Language.SPANISH]: "La inteligencia artificial es el futuro de la comunicación, y estoy entrenando mi perfil de voz personal.",
  [Language.FRENCH]: "L'intelligence artificielle est l'avenir de la communication, et je forme mon profil vocal personnel.",
  [Language.GERMAN]: "Künstliche Intelligenz ist die Zukunft der Kommunikation, und ich trainiere mein persönliches Sprachprofil.",
  [Language.CHINESE]: "人工智能是沟通的未来，我正在训练我的个人语音概况。",
  [Language.JAPANESE]: "人工知能はコミュニケーションの未来であり、私は自分のパーソナルボイスプロフィールをトレーニングしています。",
  [Language.PORTUGUESE]: "A inteligência artificial é o futuro da comunicação e estou treinando meu perfil de voz pessoal.",
  [Language.RUSSIAN]: "Искусственный интеллект — это будущее общения, и я тренирую свой персональный голосовой профиль.",
  [Language.TURKISH]: "Yapay zeka iletişimin geleceğidir ve ben kişisel ses profilimi eğitiyorum."
};

export const PREVIEW_TEXT: Record<Language, string> = {
  [Language.ENGLISH]: "Voice signal check. Studio calibration complete.",
  [Language.URDU]: "آواز کا سگنل چیک۔ اسٹوڈیو کیلیبریشن مکمل ہے۔",
  [Language.HINDI]: "वॉइस सिग्नल चेक। स्टूडियो कैलिब्रेशन पूरा हुआ।",
  [Language.ARABIC]: "فحص إشارة الصوت. اكتملت معايرة الاستوديو.",
  [Language.SPANISH]: "Prueba de señal de voz. Calibración del estudio completa.",
  [Language.FRENCH]: "Vérification du signal vocal. Calibrage du studio terminé.",
  [Language.GERMAN]: "Sprachsignalprüfung. Studiokalibrierung abgeschlossen.",
  [Language.CHINESE]: "语音信号检查。录音室校准完成。",
  [Language.JAPANESE]: "音声信号チェック。スタジオのキャリブレーションが完了しました。",
  [Language.PORTUGUESE]: "Verificação de sinal de voz. Calibração de estúdio concluída.",
  [Language.RUSSIAN]: "Проверка голосового сигнала. Калибровка студии завершена.",
  [Language.TURKISH]: "Ses sinyali kontrolü. Stüdyo kalibrasyonu tamamlandı."
};

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female'
}

export interface VoiceSituation {
  id: string;
  label: string;
  tag: string;
  icon: string;
}

export const VOICE_SITUATIONS: VoiceSituation[] = [
  { id: 'energetic', label: 'Energetic', tag: '[energetic]', icon: '⚡' },
  { id: 'calm', label: 'Calm', tag: '[calm]', icon: '🍃' },
  { id: 'sad', label: 'Emotional', tag: '[sad]', icon: '💧' },
  { id: 'loud', label: 'Loud', tag: '[loud]', icon: '📢' },
  { id: 'whisper', label: 'Whisper', tag: '[whisper]', icon: '🤫' },
  { id: 'angry', label: 'Intense', tag: '[angry]', icon: '🔥' },
  { id: 'professional', label: 'Narrative', tag: '[professional]', icon: '🎙️' },
];

export interface VoiceSettings {
  language: Language;
  gender: Gender;
  pitch: number;
  rate: number;
}

export interface ProcessingState {
  isRefining: boolean;
  isSynthesizing: boolean;
  isRecording: boolean;
  error: string | null;
}
