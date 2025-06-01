import { supabase } from '../../lib/supabaseClient';

// This API route generates a dynamic sitemap with all quizzes
export default async function handler(req, res) {
  try {
    // Set proper content type for XML
    res.setHeader('Content-Type', 'text/xml');
    
    // Fetch all public quizzes
    const { data: quizzes, error } = await supabase
      .from('quizzes')
      .select('id, updated_at')
      .eq('is_public', true)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    
    // Prepare the sitemap XML
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stemuiz.vercel.app';
    
    // Create the sitemap XML structure
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Add static routes
    const staticRoutes = [
      { path: '/', priority: '1.0', changefreq: 'daily' },
      { path: '/auth/signin', priority: '0.7', changefreq: 'monthly' },
      { path: '/auth/signup', priority: '0.7', changefreq: 'monthly' },
      { path: '/dashboard', priority: '0.8', changefreq: 'weekly' },
      { path: '/create', priority: '0.8', changefreq: 'monthly' },
    ];
    
    for (const route of staticRoutes) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${route.path}</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
      xml += `    <priority>${route.priority}</priority>\n`;
      xml += '  </url>\n';
    }
    
    // Add dynamic quiz routes
    if (quizzes && quizzes.length > 0) {
      for (const quiz of quizzes) {
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/quiz/${quiz.id}</loc>\n`;
        xml += `    <lastmod>${new Date(quiz.updated_at || new Date()).toISOString().split('T')[0]}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.6</priority>\n';
        xml += '  </url>\n';
      }
    }
    
    xml += '</urlset>';
    
    // Send the XML response
    res.status(200).send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
} 