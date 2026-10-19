import React, { useState, useRef } from 'react';
import { CardSleeve, DeckBoxSkin, Element } from '../../types';
import { ASSETS, ELEMENT_ICONS, ELEMENTAL_BACKDROPS, SOUNDS } from '../../constants';
import { 
  X, 
  Camera, 
  Upload, 
  FolderOpen, 
  Check, 
  Palette, 
  Sparkles, 
  RefreshCw, 
  Layers, 
  Maximize2, 
  Grid,
  Eye,
  Image as ImageIcon
} from 'lucide-react';
import { DeckBox3D, BOX_COLOR_PALETTES, LINING_COLOR_PALETTES } from './DeckBox3D';

interface DeckBoxDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxIndex: number;
  currentSkin: DeckBoxSkin;
  onSaveSkin: (updatedSkin: DeckBoxSkin) => void;
  cardSleeves: CardSleeve[];
  playSound: (soundUrl: string) => void;
}

const PRESET_ARTWORKS = [
  { name: 'Dragon Inferno', image: ELEMENTAL_BACKDROPS.FIRE, element: Element.FIRE },
  { name: 'Frost Glacial', image: ELEMENTAL_BACKDROPS.ICE, element: Element.ICE },
  { name: 'Tempest Storm', image: ELEMENTAL_BACKDROPS.WIND, element: Element.WIND },
  { name: 'Titan Earth', image: ELEMENTAL_BACKDROPS.EARTH, element: Element.EARTH },
  { name: 'Golden Arena', image: ASSETS.BACKDROP, element: Element.EARTH },
  { name: 'Runic Seal', image: ASSETS.CARD_TEMPLATE_ORIGINAL, element: Element.FIRE },
];

export const DeckBoxDesignerModal: React.FC<DeckBoxDesignerModalProps> = ({
  isOpen,
  onClose,
  boxIndex,
  currentSkin,
  onSaveSkin,
  cardSleeves,
  playSound,
}) => {
  const [name, setName] = useState(currentSkin.name);
  const [image, setImage] = useState(currentSkin.image || ELEMENTAL_BACKDROPS.FIRE);
  const [tileMode, setTileMode] = useState<DeckBoxSkin['tileMode']>(currentSkin.tileMode || 'cover');
  const [tileSize, setTileSize] = useState<number>(currentSkin.tileSize || 110);
  const [theme, setTheme] = useState<DeckBoxSkin['theme']>(currentSkin.theme || 'gold');
  const [element, setElement] = useState<Element>(currentSkin.element || Element.FIRE);
  const [boxColor, setBoxColor] = useState<string>(currentSkin.boxColor || 'black');
  const [liningColor, setLiningColor] = useState<string>(currentSkin.liningColor || 'yellow');

  // Outside: Image vs Solid Leather Color
  const [outsideType, setOutsideType] = useState<'image' | 'color'>(currentSkin.outsideType || 'image');

  // Inside: Velvet Color vs Inside Image
  const [insideType, setInsideType] = useState<'color' | 'image'>(currentSkin.insideType || 'color');
  const [insideImage, setInsideImage] = useState<string>(currentSkin.insideImage || currentSkin.image || ELEMENTAL_BACKDROPS.FIRE);

  // Preview Lid Open/Close State
  const [previewIsOpen, setPreviewIsOpen] = useState(false);

  // Target for photo/upload ('outside' or 'inside')
  const [mediaTarget, setMediaTarget] = useState<'outside' | 'inside'>('outside');

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Camera helpers
  const startCamera = async (target: 'outside' | 'inside', facing: 'environment' | 'user') => {
    stopCamera();
    setMediaTarget(target);
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1080 },
          height: { ideal: 1080 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setCameraFacing(facing);
    } catch {
      setCameraError('Unable to open camera. Please ensure camera permissions are allowed.');
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (cameraFacing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    
    if (mediaTarget === 'outside') {
      setImage(dataUrl);
      setOutsideType('image');
    } else {
      setInsideImage(dataUrl);
      setInsideType('image');
    }
    stopCamera();
    playSound(SOUNDS.CARD_SWIPE);
  };

  const triggerFileUpload = (target: 'outside' | 'inside') => {
    setMediaTarget(target);
    fileInputRef.current?.click();
  };

  const handleFileUpload = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (rawDataUrl) {
        if (mediaTarget === 'outside') {
          setImage(rawDataUrl);
          setOutsideType('image');
        } else {
          setInsideImage(rawDataUrl);
          setInsideType('image');
        }
        playSound(SOUNDS.CARD_SWIPE);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSaveSkin({
      id: currentSkin.id,
      name: name.trim() || `Vault ${boxIndex + 1}`,
      image,
      tileMode,
      tileSize,
      theme,
      element,
      boxColor,
      liningColor,
      outsideType,
      insideType,
      insideImage,
      updatedAt: Date.now(),
    });
    playSound(SOUNDS.GAME_WIN);
    onClose();
  };

  const previewSkin: DeckBoxSkin = {
    id: currentSkin.id,
    name: name.trim() || `Vault ${boxIndex + 1}`,
    image,
    tileMode,
    tileSize,
    theme,
    element,
    boxColor,
    liningColor,
    outsideType,
    insideType,
    insideImage,
    updatedAt: Date.now(),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92dvh] overflow-y-auto rounded-3xl bg-[#141219] border-2 border-yellow-600/60 shadow-2xl p-3.5 sm:p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-yellow-900/40 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center text-yellow-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-black text-yellow-400 uppercase tracking-wide">
                Custom Deck Box Designer #{boxIndex + 1}
              </h3>
              <p className="text-[11px] text-white/50">
                Choose exterior and interior finishes: custom images or solid colors
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors active:scale-95"
            aria-label="Close Designer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            if (e.target) e.target.value = '';
          }}
        />

        {/* Camera Modal Overlay if active */}
        {isCameraActive && (
          <div className="rounded-2xl overflow-hidden bg-black border-2 border-yellow-500 shadow-xl flex flex-col items-center p-3 animate-in fade-in">
            <div className="text-xs font-black text-yellow-400 uppercase mb-2">
              Capturing Photo for {mediaTarget === 'outside' ? 'Exterior Box' : 'Interior Lining'}
            </div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full max-h-56 object-cover rounded-xl ${cameraFacing === 'user' ? '-scale-x-100' : ''}`}
            />
            <div className="flex items-center gap-2 pt-3">
              <button
                type="button"
                onClick={capturePhoto}
                className="min-h-[40px] px-5 py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-xs uppercase shadow-md flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                <span>SNAP PHOTO</span>
              </button>
              <button
                type="button"
                onClick={() => startCamera(mediaTarget, cameraFacing === 'environment' ? 'user' : 'environment')}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-bold uppercase flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>FLIP</span>
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-red-600/80 text-white text-xs font-bold uppercase"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
        {cameraError && <p className="text-[11px] text-red-400 font-bold">{cameraError}</p>}

        {/* Controls on Left, 3D Interactive Preview on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* LEFT: Customization Controls */}
          <div className="space-y-4">
            {/* 1. Box Name */}
            <div>
              <label className="text-xs font-black uppercase text-yellow-500 tracking-wider block mb-1">
                Deck Box Title
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                placeholder={`Vault ${boxIndex + 1} Name...`}
                className="w-full bg-black/70 border border-yellow-700/50 rounded-xl px-3.5 py-2 text-yellow-200 font-bold text-xs sm:text-sm focus:border-yellow-400 outline-none transition-all placeholder:text-white/25"
              />
            </div>

            {/* ============================================================== */}
            {/* SECTION A: EXTERIOR / OUTSIDE STYLE (IMAGE OR SOLID COLOR) */}
            {/* ============================================================== */}
            <div className="bg-black/50 p-3 rounded-2xl border border-yellow-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-yellow-400 tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  <span>Outside Finish</span>
                </span>
                <span className="text-[10px] text-white/40">Select Image or Solid Leather</span>
              </div>

              {/* Outside Style Mode Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOutsideType('image');
                    playSound(SOUNDS.CARD_SWIPE);
                  }}
                  className={`min-h-[38px] px-3 rounded-xl border text-[11px] font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                    outsideType === 'image'
                      ? 'bg-yellow-500 text-black border-yellow-300 font-black shadow'
                      : 'bg-black/60 text-white/60 border-white/10'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Artwork Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOutsideType('color');
                    playSound(SOUNDS.CARD_SWIPE);
                  }}
                  className={`min-h-[38px] px-3 rounded-xl border text-[11px] font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                    outsideType === 'color'
                      ? 'bg-yellow-500 text-black border-yellow-300 font-black shadow'
                      : 'bg-black/60 text-white/60 border-white/10'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Solid Leather Color</span>
                </button>
              </div>

              {/* If Outside is Image: Options for image upload, presets, coverage */}
              {outsideType === 'image' && (
                <div className="space-y-3 pt-1 animate-in fade-in">
                  {/* Coverage Mode */}
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTileMode('cover');
                          playSound(SOUNDS.CARD_SWIPE);
                        }}
                        className={`min-h-[34px] px-2 rounded-lg border text-[9.5px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${
                          tileMode === 'cover'
                            ? 'bg-yellow-400 text-black border-yellow-300 font-black shadow'
                            : 'bg-black/40 text-white/50 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Cover</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTileMode('contain');
                          playSound(SOUNDS.CARD_SWIPE);
                        }}
                        className={`min-h-[34px] px-2 rounded-lg border text-[9.5px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${
                          tileMode === 'contain'
                            ? 'bg-yellow-400 text-black border-yellow-300 font-black shadow'
                            : 'bg-black/40 text-white/50 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <Layers className="w-3 h-3" />
                        <span>Fit (Black Sides)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTileMode('repeat');
                          playSound(SOUNDS.CARD_SWIPE);
                        }}
                        className={`min-h-[34px] px-2 rounded-lg border text-[9.5px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${
                          tileMode === 'repeat'
                            ? 'bg-yellow-400 text-black border-yellow-300 font-black shadow'
                            : 'bg-black/40 text-white/50 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <Grid className="w-3 h-3" />
                        <span>Pattern</span>
                      </button>
                    </div>
                    <p className="text-[9.5px] text-white/40 italic">
                      Transparent PNGs automatically fill remaining face areas with solid black.
                    </p>
                  </div>

                  {/* Upload / Camera Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startCamera('outside', 'environment')}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-black text-xs uppercase shadow flex items-center gap-1.5 active:scale-95"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Snap Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerFileUpload('outside')}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-yellow-500/40 text-yellow-300 font-bold text-xs uppercase flex items-center gap-1.5 active:scale-95"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Upload File</span>
                    </button>
                  </div>

                  {/* Preset Elemental Artwork picker */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-yellow-500 block">
                      Preset Artwork
                    </span>
                    <div className="flex gap-2 overflow-x-auto py-1 max-w-full">
                      {PRESET_ARTWORKS.map((preset) => {
                        const isSelected = image === preset.image;
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setImage(preset.image);
                              setElement(preset.element);
                              playSound(SOUNDS.CARD_SWIPE);
                            }}
                            className={`relative shrink-0 w-14 h-18 rounded-lg overflow-hidden border-2 transition-all active:scale-95 ${
                              isSelected ? 'border-yellow-400 scale-105 shadow-[0_0_10px_rgba(234,179,8,0.8)]' : 'border-white/20 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img src={preset.image} alt={preset.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-black/85 py-0.5 text-center">
                              <span className="text-[7px] font-bold text-yellow-300">{preset.name}</span>
                            </div>
                            {isSelected && (
                              <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-yellow-400 text-black flex items-center justify-center">
                                <Check className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sleeves as box texture */}
                  {cardSleeves.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-yellow-500 block">
                        Card Sleeves
                      </span>
                      <div className="flex gap-2 overflow-x-auto py-1 max-w-full">
                        {cardSleeves.map((sleeve) => {
                          const isSelected = image === sleeve.image;
                          return (
                            <button
                              key={sleeve.id}
                              type="button"
                              onClick={() => {
                                setImage(sleeve.image);
                                playSound(SOUNDS.CARD_SWIPE);
                              }}
                              className={`relative shrink-0 w-12 h-16 rounded-md overflow-hidden border-2 transition-all active:scale-95 ${
                                isSelected ? 'border-yellow-400 scale-105 shadow-[0_0_10px_rgba(234,179,8,0.8)]' : 'border-white/20 opacity-70 hover:opacity-100'
                              }`}
                            >
                              <img src={sleeve.image} alt={sleeve.name} className="w-full h-full object-cover" />
                              {isSelected && (
                                <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-yellow-400 text-black flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* If Outside is Solid Color: Leather color palette */}
              {outsideType === 'color' && (
                <div className="space-y-1 pt-1 animate-in fade-in">
                  <span className="text-[10px] font-bold uppercase text-yellow-500 block">
                    Choose Leather Color
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(BOX_COLOR_PALETTES).map(([key, pal]) => {
                      const isSelected = boxColor === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setBoxColor(key);
                            playSound(SOUNDS.CARD_SWIPE);
                          }}
                          className={`min-h-[38px] px-2 py-1 rounded-xl border text-[10px] font-black uppercase flex items-center gap-1.5 transition-all ${
                            isSelected
                              ? 'bg-white/20 border-yellow-400 text-yellow-300 shadow font-black'
                              : 'bg-black/50 border-white/10 text-white/60 hover:border-white/20'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow"
                            style={{ backgroundColor: pal.hex }}
                          />
                          <span className="truncate">{pal.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* SECTION B: INTERIOR / INSIDE STYLE (VELVET COLOR OR IMAGE) */}
            {/* ============================================================== */}
            <div className="bg-black/50 p-3 rounded-2xl border border-yellow-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-yellow-400 tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Inside Finish</span>
                </span>
                <span className="text-[10px] text-white/40">Velvet Color or Custom Image</span>
              </div>

              {/* Inside Style Mode Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInsideType('color');
                    playSound(SOUNDS.CARD_SWIPE);
                  }}
                  className={`min-h-[38px] px-3 rounded-xl border text-[11px] font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                    insideType === 'color'
                      ? 'bg-yellow-500 text-black border-yellow-300 font-black shadow'
                      : 'bg-black/60 text-white/60 border-white/10'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Velvet Color</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInsideType('image');
                    playSound(SOUNDS.CARD_SWIPE);
                  }}
                  className={`min-h-[38px] px-3 rounded-xl border text-[11px] font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                    insideType === 'image'
                      ? 'bg-yellow-500 text-black border-yellow-300 font-black shadow'
                      : 'bg-black/60 text-white/60 border-white/10'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Inside Image</span>
                </button>
              </div>

              {/* If Inside is Velvet Color: Lining Palette */}
              {insideType === 'color' && (
                <div className="space-y-1 pt-1 animate-in fade-in">
                  <span className="text-[10px] font-bold uppercase text-yellow-500 block">
                    Choose Velvet Color
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(LINING_COLOR_PALETTES).map(([key, pal]) => {
                      const isSelected = liningColor === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setLiningColor(key);
                            playSound(SOUNDS.CARD_SWIPE);
                          }}
                          className={`min-h-[38px] px-2 py-1 rounded-xl border text-[10px] font-black uppercase flex items-center gap-1.5 transition-all ${
                            isSelected
                              ? 'bg-white/20 border-yellow-400 text-yellow-300 shadow font-black'
                              : 'bg-black/50 border-white/10 text-white/60 hover:border-white/20'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow"
                            style={{ backgroundColor: pal.hex }}
                          />
                          <span className="truncate">{pal.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* If Inside is Image: Option to match exterior or select distinct interior image */}
              {insideType === 'image' && (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInsideImage(image);
                        playSound(SOUNDS.CARD_SWIPE);
                      }}
                      className="min-h-[34px] px-3 rounded-lg bg-white/10 hover:bg-white/20 border border-yellow-500/40 text-yellow-300 text-[10px] font-bold uppercase"
                    >
                      Same As Outside
                    </button>
                    <button
                      type="button"
                      onClick={() => startCamera('inside', 'environment')}
                      className="min-h-[34px] px-3 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 text-black text-[10px] font-black uppercase flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Snap Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerFileUpload('inside')}
                      className="min-h-[34px] px-3 rounded-lg bg-white/10 text-white text-[10px] font-bold uppercase flex items-center gap-1"
                    >
                      <FolderOpen className="w-3 h-3" />
                      <span>Upload</span>
                    </button>
                  </div>

                  {/* Inside Presets */}
                  <div className="flex gap-2 overflow-x-auto py-1 max-w-full">
                    {PRESET_ARTWORKS.map((preset) => {
                      const isSelected = insideImage === preset.image;
                      return (
                        <button
                          key={`inside-${preset.name}`}
                          type="button"
                          onClick={() => {
                            setInsideImage(preset.image);
                            playSound(SOUNDS.CARD_SWIPE);
                          }}
                          className={`relative shrink-0 w-12 h-16 rounded-md overflow-hidden border-2 transition-all active:scale-95 ${
                            isSelected ? 'border-yellow-400 scale-105 shadow' : 'border-white/20 opacity-70'
                          }`}
                        >
                          <img src={preset.image} alt={preset.name} className="w-full h-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Live Interactive 3D Preview (Spinnable 360° + Open/Close Peek) */}
          <div className="flex flex-col items-center justify-center bg-black/60 rounded-3xl border border-yellow-900/40 p-4 sm:p-6 shadow-inner relative overflow-hidden">
            <div className="w-full flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-yellow-400 uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                <span>3D Live Preview</span>
              </div>

              {/* Peek Inside Button */}
              <button
                type="button"
                onClick={() => {
                  setPreviewIsOpen(!previewIsOpen);
                  playSound(SOUNDS.CARD_SWIPE);
                }}
                className={`min-h-[32px] px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  previewIsOpen
                    ? 'bg-yellow-400 text-black border-yellow-300'
                    : 'bg-black/80 text-yellow-300 border-yellow-500/40 hover:bg-yellow-950/60'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>{previewIsOpen ? 'CLOSE LID' : 'PEEK INSIDE'}</span>
              </button>
            </div>

            <div className="py-2 w-full flex justify-center">
              <DeckBox3D
                boxIndex={boxIndex}
                vaultName={previewSkin.name}
                deckCards={[]}
                deckSize={20}
                isEquipped={false}
                skin={previewSkin}
                isOpen={previewIsOpen}
                onToggleOpen={() => setPreviewIsOpen(!previewIsOpen)}
                playSound={playSound}
                isActiveInCarousel={true}
              />
            </div>
            <p className="text-[10px] text-white/45 italic text-center mt-1">
              Drag to spin 360° • Tap box or "Peek Inside" to check the interior finish
            </p>
          </div>
        </div>

        {/* Footer: Save Button */}
        <div className="border-t border-yellow-900/40 pt-3 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase transition-colors"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[44px] px-7 py-2 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-black" />
            <span>SAVE 3D DECK BOX</span>
          </button>
        </div>
      </div>
    </div>
  );
};
