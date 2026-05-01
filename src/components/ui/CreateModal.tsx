import React, { useState, useEffect } from 'react';
import { X, Hash, Loader2, LayoutGrid, Shield, Globe, Lock, ChevronDown, Settings2, Volume2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { matrixService } from '../../core/matrix';
import { cn } from '../../utils/cn';
import * as sdk from 'matrix-js-sdk';

export const CreateModal: React.FC = () => {
  const { isCreateModalOpen, createModalType, setCreateModalOpen, setExploreOpen, activeSpaceId, setActiveRoomId, setActiveSpaceId } = useAppStore();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [roomType, setRoomType] = useState<'text' | 'voice'>('text');
  const [visibility, setVisibility] = useState<sdk.Visibility>(sdk.Visibility.Private);
  const [isEncrypted, setIsEncrypted] = useState(true);
  const [alias, setAlias] = useState('');
  const [speakerLevel, setSpeakerLevel] = useState<'everyone' | 'moderators' | 'admins'>('everyone');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync encryption with visibility
  useEffect(() => {
    if (visibility === sdk.Visibility.Public) {
      setIsEncrypted(false);
    } else {
      setIsEncrypted(true);
    }
  }, [visibility]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      if (createModalType === 'space') {
        const result = await matrixService.createSpace(name, topic);
        if (result && result.room_id) {
          setActiveSpaceId(result.room_id);
          resetAndClose();
        }
      } else {
        const powerLevels: any = {};
        if (speakerLevel === 'moderators') powerLevels.events_default = 50;
        if (speakerLevel === 'admins') powerLevels.events_default = 100;

        const result = await matrixService.createRoom({
          name,
          topic,
          roomType,
          spaceId: activeSpaceId || undefined,
          visibility,
          alias: visibility === sdk.Visibility.Public ? alias : undefined,
          isEncrypted: roomType === 'voice' ? false : isEncrypted,
          powerLevels: Object.keys(powerLevels).length > 0 ? powerLevels : undefined
        });

        if (result && result.room_id) {
          setActiveRoomId(result.room_id);
          resetAndClose();
        }
      }
    } catch (err: any) {
      console.error(`Failed to create ${createModalType}:`, err);
      setError(err.message || `Failed to create ${createModalType}`);
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setCreateModalOpen(false);
    setName('');
    setTopic('');
    setAlias('');
    setRoomType('text');
    setVisibility(sdk.Visibility.Private);
    setIsEncrypted(true);
    setSpeakerLevel('everyone');
    setShowAdvanced(false);
  };

  if (!isCreateModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border-main bg-bg-nav shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-main px-6 py-4 bg-bg-nav/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary/20">
              {createModalType === 'space' ? (
                <LayoutGrid className="h-5 w-5 text-accent-primary" />
              ) : (
                <Hash className="h-5 w-5 text-accent-primary" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter text-white">
                Create {createModalType === 'space' ? 'Space' : 'Room'}
              </h2>
              <p className="text-xs text-text-muted font-medium">
                {createModalType === 'space' 
                  ? 'Spaces are communities that house your channels' 
                  : `New channel in ${activeSpaceId ? 'current space' : 'Direct Messages'}`}
              </p>
            </div>
          </div>
          <button 
            onClick={resetAndClose}
            className="rounded-full p-2 text-text-muted transition hover:bg-bg-hover hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[70vh] no-scrollbar">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-3 text-xs text-red-400 font-bold flex items-center space-x-2">
              <X className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            {createModalType === 'room' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Channel Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRoomType('text')}
                    className={cn(
                      "flex items-center space-x-3 p-3 rounded-xl border transition-all text-left",
                      roomType === 'text' 
                        ? "border-accent-primary bg-accent-primary/10 text-white ring-1 ring-accent-primary" 
                        : "border-border-main bg-bg-main text-text-muted hover:border-text-muted/30"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      roomType === 'text' ? "bg-accent-primary text-bg-main" : "bg-bg-hover text-text-muted"
                    )}>
                      <Hash className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-tight">Text</div>
                      <div className="text-[9px] opacity-70">Send messages, images, and files</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoomType('voice')}
                    className={cn(
                      "flex items-center space-x-3 p-3 rounded-xl border transition-all text-left",
                      roomType === 'voice' 
                        ? "border-accent-primary bg-accent-primary/10 text-white ring-1 ring-accent-primary" 
                        : "border-border-main bg-bg-main text-text-muted hover:border-text-muted/30"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      roomType === 'voice' ? "bg-accent-primary text-bg-main" : "bg-bg-hover text-text-muted"
                    )}>
                      <Volume2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-tight">Voice</div>
                      <div className="text-[9px] opacity-70">Hang out with voice and video</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">
                {createModalType === 'space' ? 'Space' : 'Room'} Name
              </label>
              <div className="relative">
                {createModalType === 'room' && (
                  <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                )}
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={createModalType === 'space' ? 'My Awesome Community' : 'general'}
                  className={cn(
                    "w-full rounded-xl border border-border-main bg-bg-main py-3 pr-4 text-sm font-bold text-white placeholder-text-muted/50 transition focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary",
                    createModalType === 'room' ? "pl-10" : "pl-4"
                  )}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">
                Topic (Optional)
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What's this about?"
                className="w-full rounded-xl border border-border-main bg-bg-main py-3 px-4 text-sm font-medium text-white placeholder-text-muted/50 transition focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                disabled={loading}
              />
            </div>
          </div>

          {createModalType === 'room' && (
            <>
              {/* Visibility & Security */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Visibility</label>
                  <div className="flex p-1 rounded-xl bg-bg-main border border-border-main">
                    <button
                      type="button"
                      onClick={() => setVisibility(sdk.Visibility.Private)}
                      className={cn(
                        "flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-bold transition",
                        visibility === sdk.Visibility.Private ? "bg-accent-primary text-bg-main shadow-lg" : "text-text-muted hover:text-white"
                      )}
                    >
                      <Lock className="h-3 w-3" />
                      <span>Private</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility(sdk.Visibility.Public)}
                      className={cn(
                        "flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-bold transition",
                        visibility === sdk.Visibility.Public ? "bg-accent-primary text-bg-main shadow-lg" : "text-text-muted hover:text-white"
                      )}
                    >
                      <Globe className="h-3 w-3" />
                      <span>Public</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Encryption</label>
                  <button
                    type="button"
                    onClick={() => visibility !== sdk.Visibility.Public && setIsEncrypted(!isEncrypted)}
                    disabled={visibility === sdk.Visibility.Public}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border transition",
                      isEncrypted ? "border-green-500/50 bg-green-500/5 text-green-400" : "border-border-main bg-bg-main text-text-muted",
                      visibility === sdk.Visibility.Public && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center space-x-2">
                      <Shield className={cn("h-4 w-4", isEncrypted ? "text-green-400" : "text-text-muted")} />
                      <span className="text-xs font-bold">{isEncrypted ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div className={cn(
                      "w-8 h-4 rounded-full relative transition-colors duration-200",
                      isEncrypted ? "bg-green-500" : "bg-bg-hover"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 shadow-sm",
                        isEncrypted ? "left-4.5" : "left-0.5"
                      )} />
                    </div>
                  </button>
                </div>
              </div>

              {/* Alias */}
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Local Address (Alias)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">#</span>
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="room-name"
                    className="w-full rounded-xl border border-border-main bg-bg-main py-3 pl-8 pr-4 text-sm font-bold text-white placeholder-text-muted/50 transition focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  />
                </div>
                <p className="text-[9px] text-text-muted italic ml-1">
                  {visibility === sdk.Visibility.Public 
                    ? "This makes the room findable via #name:server.com" 
                    : "A private address for this room on your server"}
                </p>
              </div>

              {/* Basic Permissions */}
              <div className="space-y-2">
                <div 
                  className="flex items-center justify-between cursor-pointer group/adv"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Who can speak?</label>
                  <Settings2 className={cn("h-3 w-3 transition", showAdvanced ? "text-accent-primary" : "text-text-muted group-hover/adv:text-white")} />
                </div>
                
                <div className="relative">
                  <select
                    value={speakerLevel}
                    onChange={(e) => setSpeakerLevel(e.target.value as any)}
                    className="w-full appearance-none rounded-xl border border-border-main bg-bg-main py-3 px-4 text-sm font-bold text-white transition focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary cursor-pointer"
                  >
                    <option value="everyone">Everyone (Standard)</option>
                    <option value="moderators">Moderators (Power 50+)</option>
                    <option value="admins">Admins Only (Power 100)</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                </div>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-border-main/50">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-text-muted hover:text-white transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || (visibility === sdk.Visibility.Public && !alias.trim())}
              className="flex min-w-[140px] items-center justify-center space-x-2 rounded-xl bg-accent-primary px-6 py-2.5 text-xs font-black uppercase tracking-widest text-bg-main transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-accent-primary/20"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Create {createModalType === 'space' ? 'Space' : 'Room'}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {createModalType === 'space' && (
          <div className="bg-bg-hover/50 p-4 border-t border-border-main flex flex-col items-center space-y-2">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Have an invite already?</p>
            <button
              onClick={() => {
                resetAndClose();
                setExploreOpen(true);
              }}
              className="w-full py-3 rounded-xl border border-border-main bg-bg-main text-xs font-black uppercase tracking-widest text-white hover:bg-bg-hover transition shadow-sm"
            >
              Join an existing space
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
