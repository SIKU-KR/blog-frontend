'use client';

import { useSyncExternalStore } from 'react';
import Container from '@/components/ui/Container';
import ClientMarkdownRenderer from '@/components/ui/data-display/ClientMarkdownRenderer';
import Divider from '@/components/ui/Divider';

interface PreviewData {
  title: string;
  content: string;
  summary: string;
  timestamp: number;
}

const PREVIEW_DATA_KEY = 'blog-preview-data';
const PREVIEW_DATA_EXPIRY = 30 * 60 * 1000; // 30 minutes

function subscribePreviewData(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  queueMicrotask(onStoreChange);
  window.addEventListener('storage', onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
  };
}

function getPreviewSnapshot() {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return localStorage.getItem(PREVIEW_DATA_KEY) ?? '';
  } catch (e) {
    console.error('미리보기 데이터 로드 오류:', e);
    return '';
  }
}

function parsePreviewData(snapshot: string): { data: PreviewData | null; error: string | null } {
  try {
    if (!snapshot) {
      return {
        data: null,
        error: '미리보기 데이터가 없습니다. 에디터에서 미리보기 버튼을 클릭해주세요.',
      };
    }

    const parsed: PreviewData = JSON.parse(snapshot);

    // Check expiration
    if (Date.now() - parsed.timestamp > PREVIEW_DATA_EXPIRY) {
      return {
        data: null,
        error: '미리보기 데이터가 만료되었습니다. 에디터에서 다시 미리보기를 열어주세요.',
      };
    }

    return { data: parsed, error: null };
  } catch (e) {
    console.error('미리보기 데이터 로드 오류:', e);
    return { data: null, error: '미리보기 데이터를 불러오는 데 실패했습니다.' };
  }
}

export default function PreviewPage() {
  const previewSnapshot = useSyncExternalStore(subscribePreviewData, getPreviewSnapshot, () => '');
  const { data, error } = parsePreviewData(previewSnapshot);

  if (error) {
    return (
      <Container size="md" className="py-8">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.close()}
            className="text-blue-600 hover:text-blue-800 transition-colors"
          >
            창 닫기
          </button>
        </div>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container size="md" className="py-8">
        <div className="text-center text-gray-500">불러오는 중...</div>
      </Container>
    );
  }

  const formattedDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Container size="md" className="py-4">
      {/* Preview Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-yellow-600 font-medium">미리보기 모드</span>
          <span className="text-sm text-yellow-700">
            이 페이지는 실제 게시물이 아닌 미리보기입니다.
          </span>
        </div>
        <button
          onClick={() => window.close()}
          className="text-sm text-yellow-700 hover:text-yellow-900 underline"
        >
          닫기
        </button>
      </div>

      <article>
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{data.title || '제목 없음'}</h1>
          <div className="flex items-center text-sm text-gray-500">
            <span className="mr-2">Siku</span>
            <time>{formattedDate}</time>
          </div>
        </header>

        <Divider variant="border" />

        <div>
          <ClientMarkdownRenderer content={data.content || '내용을 입력하세요...'} />
        </div>
      </article>
    </Container>
  );
}
