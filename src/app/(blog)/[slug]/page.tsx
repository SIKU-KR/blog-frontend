import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Container from '@/components/ui/Container';
import Loading from '@/components/ui/feedback/Loading';
import ErrorMessage from '@/components/ui/feedback/ErrorMessage';
import Divider from '@/components/ui/Divider';
import ServerMarkdownRenderer from '@/components/ui/data-display/ServerMarkdownRenderer';
import { Metadata } from 'next';
import Link from 'next/link';
import { RelatedPosts, ShareButton } from '@/features/posts/components';
import { getPostMetadata } from '@/lib/metadata';
import { postService, embeddingService } from '@/lib/services';
import { NotFoundError } from '@/lib/utils/validation';

interface PostDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await postService.getPostBySlug(slug);

    const description = post.summary || post.content.slice(0, 150).replace(/[#*`]/g, '');
    const createdAt =
      post.createdAt instanceof Date ? post.createdAt.toISOString() : String(post.createdAt);
    const updatedAt =
      post.updatedAt instanceof Date ? post.updatedAt.toISOString() : String(post.updatedAt);
    const canonicalPath = `/${post.slug}`;

    return getPostMetadata(post.title, description, post.slug, canonicalPath, createdAt, updatedAt);
  } catch (error) {
    if (!(error instanceof NotFoundError)) {
      console.error('Metadata generation error:', error);
    }
    return {
      title: '게시물을 찾을 수 없음',
      description: '요청하신 게시물을 찾을 수 없습니다.',
    };
  }
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { slug } = await params;

  let post: Awaited<ReturnType<typeof postService.getPostBySlug>> | null = null;
  let loadError: unknown = null;

  try {
    post = await postService.getPostBySlug(slug);
  } catch (err: unknown) {
    loadError = err;
  }

  if (loadError) {
    if (loadError instanceof NotFoundError) {
      notFound();
    }

    console.error('Error loading data:', loadError);

    const errorStr = loadError instanceof Error ? loadError.message : String(loadError);
    if (errorStr.includes('not found') || errorStr.includes('Not found')) {
      notFound();
    }

    return (
      <Container size="md" className="py-8">
        <ErrorMessage message="데이터를 불러오는 중 오류가 발생했습니다." />
        <div className="mt-4 text-center">
          <Link href="/" className="text-blue-600 hover:text-blue-800 transition-colors">
            홈으로 돌아가기
          </Link>
        </div>
      </Container>
    );
  }

  if (!post || !post.id) {
    notFound();
  }

  // Get related posts
  let relatedPosts: Array<{ id: number; slug: string; title: string; score: number }> = [];
  try {
    const similar = await embeddingService.findSimilarPosts(post.id, 4);
    relatedPosts = similar.map(p => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      score: p.similarity,
    }));
  } catch {
    // Gracefully handle embedding service failures
  }

  const createdAt =
    post.createdAt instanceof Date ? post.createdAt.toISOString() : String(post.createdAt);
  const formattedDate = new Date(createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Container size="md" className="py-4">
      <article itemScope itemType="https://schema.org/BlogPosting">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2" itemProp="headline">
            {post.title}
          </h1>
          <div className="flex items-center text-sm text-gray-500">
            <span className="mr-2" itemProp="author" itemScope itemType="https://schema.org/Person">
              <span itemProp="name">Siku</span>
            </span>
            <time itemProp="datePublished" dateTime={createdAt}>
              {formattedDate}
            </time>
            <div className="ml-auto">
              <ShareButton className="hover:bg-gray-100" canonicalUrl={`/${post.slug}`} />
            </div>
          </div>
        </header>

        <Divider variant="border" />

        <div itemProp="articleBody">
          <Suspense fallback={<Loading />}>
            <ServerMarkdownRenderer content={post.content} />
          </Suspense>
        </div>
      </article>

      {relatedPosts.length > 0 && (
        <>
          <Divider variant="border" />
          <RelatedPosts posts={relatedPosts} maxPosts={2} title="추천 게시물" />
        </>
      )}
    </Container>
  );
}

export async function generateStaticParams() {
  try {
    const { sitemapService } = await import('@/lib/services');
    const sitemap = await sitemapService.getSitemapData();

    const params: { slug: string }[] = sitemap.map(entry => ({ slug: entry.slug }));

    return params;
  } catch (error) {
    console.error('Error generating static paths:', error);
    return [];
  }
}

export const revalidate = 60;
