import Head from 'next/head';
import { useRouter } from 'next/router';

export default function SEO({
  title = 'Interactive STEM Quizzes',
  description = 'Create and play interactive quizzes for Science, Technology, Engineering, and Mathematics. Perfect for classrooms, study groups, and STEM enthusiasts.',
  keywords = 'STEM quiz, science quiz, technology quiz, engineering quiz, math quiz',
  ogImage = '/og-image.png',
  ogType = 'website',
  twitterCard = 'summary_large_image',
  noIndex = false,
  children
}) {
  const router = useRouter();
  const siteUrl = 'https://stemuiz.vercel.app';
  const canonicalUrl = `${siteUrl}${router.asPath}`;
  const fullTitle = `STEMuiz - ${title}`;
  
  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`${siteUrl}${ogImage}`} />
      
      {/* Twitter */}
      <meta property="twitter:card" content={twitterCard} />
      <meta property="twitter:url" content={canonicalUrl} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={`${siteUrl}${ogImage}`} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'STEMuiz',
            url: siteUrl,
            description: 'Interactive STEM Quizzes for Science, Technology, Engineering & Math',
            potentialAction: {
              '@type': 'SearchAction',
              target: `${siteUrl}/search?q={search_term_string}`,
              'query-input': 'required name=search_term_string'
            }
          })
        }}
      />
      
      {children}
    </Head>
  );
} 