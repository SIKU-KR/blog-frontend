import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';
import { draftStorage, type Draft, type DraftSnapshot } from '@/lib/utils/draft-storage';

const AUTO_SAVE_INTERVAL = 30000; // 30초

/**
 * 임시저장 관리 Hook
 * - 자동 저장 (30초 간격)
 * - 수동 저장
 * - 불러오기/삭제 기능
 */
export function useDraftManagement(currentDraft: DraftSnapshot) {
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(() => {
    const drafts = draftStorage.getDrafts();
    const autoDraft = drafts.find(draft => draft.isAutoSave && draft.timestamp);
    return autoDraft ? new Date(autoDraft.timestamp) : null;
  });
  const previousDraftJSONRef = useRef<string | null>(null);

  const handleAutoSave = useCallback(() => {
    const snapshot = currentDraft;
    const normalizedTitle = snapshot.title.trim();
    const hasContent =
      normalizedTitle || snapshot.content.trim() || snapshot.summary.trim() || snapshot.slug.trim();

    if (!hasContent) return;

    try {
      const serializedSnapshot = JSON.stringify(snapshot);
      if (serializedSnapshot === previousDraftJSONRef.current) return;

      const now = new Date();
      const timestamp = now.toISOString();
      const draftTitle = normalizedTitle || '제목 없음';

      const autoDraft: Draft = {
        ...snapshot,
        id: 'auto-draft',
        title: draftTitle,
        timestamp,
        displayName: `${now.toLocaleString()} - ${draftTitle}`,
        isAutoSave: true,
      };

      draftStorage.addDraft(autoDraft);
      previousDraftJSONRef.current = serializedSnapshot;
      setLastAutoSavedAt(now);

      logger.debug('자동 임시저장 완료', { draftTitle });
    } catch (error) {
      logger.error('자동 임시저장 오류', error);
    }
  }, [currentDraft]);

  // 자동 저장 로직
  useEffect(() => {
    let intervalId: number | null = null;

    try {
      intervalId = window.setInterval(handleAutoSave, AUTO_SAVE_INTERVAL);
    } catch (error) {
      logger.error('자동 임시저장 인터벌 설정 오류', error);
    }

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [handleAutoSave]);

  // 수동 저장
  const saveDraft = useCallback((): boolean => {
    const snapshot = currentDraft;
    if (!snapshot.title.trim() && !snapshot.content.trim()) return false;

    try {
      const now = new Date();
      const timestamp = now.toISOString();
      const draftTitle = snapshot.title.trim() || '제목 없음';

      const newDraft: Draft = {
        ...snapshot,
        id: `manual-${Date.now()}`,
        title: draftTitle,
        timestamp,
        displayName: `${now.toLocaleString()} - ${draftTitle}`,
      };

      draftStorage.addDraft(newDraft);
      logger.debug('수동 임시저장 완료', { draftTitle });
      return true;
    } catch (error) {
      logger.error('수동 임시저장 오류', error);
      return false;
    }
  }, [currentDraft]);

  return {
    lastAutoSavedAt,
    getDraftsList: useCallback(() => draftStorage.getDrafts(), []),
    saveDraft,
    deleteDraft: useCallback((id: string) => draftStorage.deleteDraft(id), []),
    deleteAllDrafts: useCallback(() => draftStorage.clearAll(), []),
  };
}
