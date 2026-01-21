// worker.js - Main Cloudflare Worker for Feedback Analytics Dashboard

export default {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      
      // CORS headers for all responses
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
  
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
  
      // Route: API endpoints
      if (url.pathname.startsWith('/api/')) {
        return handleAPI(request, env, url, corsHeaders);
      }
  
      // Route: Serve the dashboard HTML
      return new Response(getDashboardHTML(), {
        headers: {
          'Content-Type': 'text/html',
          ...corsHeaders,
        },
      });
    },
  };
  
  async function handleAPI(request, env, url, corsHeaders) {
    const path = url.pathname;
  
    try {
      // GET /api/feedback - Fetch all feedback with optional filters
      if (path === '/api/feedback' && request.method === 'GET') {
        const source = url.searchParams.get('source');
        const sentiment = url.searchParams.get('sentiment');
        const urgency = url.searchParams.get('urgency');
        
        // Try to get cached results first
        const cacheKey = `feedback:${source || 'all'}:${sentiment || 'all'}:${urgency || 'all'}`;
        let cachedData = await env.FEEDBACK_CACHE.get(cacheKey);
        
        if (cachedData) {
          return new Response(cachedData, {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
  
        // Build query
        let query = 'SELECT * FROM feedback WHERE 1=1';
        const params = [];
        
        if (source && source !== 'all') {
          query += ' AND source = ?';
          params.push(source);
        }
        if (sentiment && sentiment !== 'all') {
          query += ' AND sentiment = ?';
          params.push(sentiment);
        }
        if (urgency && urgency !== 'all') {
          query += ' AND urgency = ?';
          params.push(urgency);
        }
        
        query += ' ORDER BY created_at DESC';
  
        const { results } = await env.FEEDBACK_DB.prepare(query).bind(...params).all();
        
        // Cache results for 5 minutes
        await env.FEEDBACK_CACHE.put(cacheKey, JSON.stringify(results), {
          expirationTtl: 300,
        });
  
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
  
      // POST /api/feedback - Add new feedback
      if (path === '/api/feedback' && request.method === 'POST') {
        const data = await request.json();
        
        await env.FEEDBACK_DB.prepare(
          `INSERT INTO feedback (company, source, task, issue, solution, feedback_text, sentiment, urgency, category, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          data.company,
          data.source,
          data.task,
          data.issue,
          data.solution || '',
          data.feedback,
          data.sentiment || 'neutral',
          data.urgency || 'medium',
          data.category || 'General',
          new Date().toISOString()
        ).run();
  
        // Invalidate cache
        await invalidateCache(env);
  
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
  
      // GET /api/analytics - Get aggregated analytics
      if (path === '/api/analytics' && request.method === 'GET') {
        const cached = await env.FEEDBACK_CACHE.get('analytics:summary');
        
        if (cached) {
          return new Response(cached, {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
  
        // Sentiment counts
        const sentimentQuery = await env.FEEDBACK_DB.prepare(
          'SELECT sentiment, COUNT(*) as count FROM feedback GROUP BY sentiment'
        ).all();
  
        // Category counts
        const categoryQuery = await env.FEEDBACK_DB.prepare(
          'SELECT category, COUNT(*) as count FROM feedback GROUP BY category ORDER BY count DESC'
        ).all();
  
        // Source counts
        const sourceQuery = await env.FEEDBACK_DB.prepare(
          'SELECT source, COUNT(*) as count FROM feedback GROUP BY source'
        ).all();
  
        // Urgency counts
        const urgencyQuery = await env.FEEDBACK_DB.prepare(
          'SELECT urgency, COUNT(*) as count FROM feedback GROUP BY urgency'
        ).all();
  
        // Total count
        const totalQuery = await env.FEEDBACK_DB.prepare(
          'SELECT COUNT(*) as total FROM feedback'
        ).first();
  
        // Trend over time (last 7 days)
        const trendQuery = await env.FEEDBACK_DB.prepare(
          `SELECT DATE(created_at) as date, COUNT(*) as count 
           FROM feedback 
           WHERE created_at >= datetime('now', '-7 days')
           GROUP BY DATE(created_at) 
           ORDER BY date ASC`
        ).all();
  
        const analytics = {
          total: totalQuery.total,
          sentiment: sentimentQuery.results,
          categories: categoryQuery.results,
          sources: sourceQuery.results,
          urgency: urgencyQuery.results,
          trend: trendQuery.results,
        };
  
        // Cache for 2 minutes
        await env.FEEDBACK_CACHE.put('analytics:summary', JSON.stringify(analytics), {
          expirationTtl: 120,
        });
  
        return new Response(JSON.stringify(analytics), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
  
      // POST /api/init - Initialize database with sample data
      if (path === '/api/init' && request.method === 'POST') {
        await initializeDatabase(env);
        return new Response(JSON.stringify({ success: true, message: 'Database initialized' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
  
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }
  
  async function invalidateCache(env) {
    const cacheKeys = [
      'analytics:summary',
      'feedback:all:all:all',
      'feedback:all:negative:all',
      'feedback:all:neutral:all',
      'feedback:all:positive:all',
    ];
    
    for (const key of cacheKeys) {
      await env.FEEDBACK_CACHE.delete(key);
    }
  }
  
  async function initializeDatabase(env) {
    const sampleData = [
      ['Acme Corp', 'Support Ticket', 'API Rate Limiting', 'Rate limits too restrictive for burst traffic', 'Implement token bucket algorithm', 'Need more flexible rate limiting options', 'negative', 'high', 'Performance', '2026-01-15T10:30:00'],
      ['TechStart Inc', 'Discord', 'Dashboard Navigation', 'Difficulty finding analytics section', 'Redesign navigation menu', 'Love the product but navigation is confusing', 'neutral', 'medium', 'UX', '2026-01-15T14:20:00'],
      ['Global Systems', 'GitHub Issue', 'Worker Deployment', 'Deployment times exceed 2 minutes', 'Optimize build pipeline', 'Deployment is too slow compared to competitors', 'negative', 'high', 'Performance', '2026-01-14T09:15:00'],
      ['DataFlow LLC', 'Email', 'Documentation', 'Missing examples for D1 database queries', 'Add comprehensive examples section', 'Need more real-world examples', 'neutral', 'medium', 'Documentation', '2026-01-14T16:45:00'],
      ['CloudNative Co', 'Twitter', 'Billing Dashboard', 'Cannot understand usage breakdown', 'Add detailed usage analytics', 'Billing is opaque, need better visibility', 'negative', 'high', 'Billing', '2026-01-13T11:30:00'],
    ];
  
    for (const data of sampleData) {
      await env.FEEDBACK_DB.prepare(
        `INSERT INTO feedback (company, source, task, issue, solution, feedback_text, sentiment, urgency, category, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(...data).run();
    }
  }
  
  function getDashboardHTML() {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feedback Analytics Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  </head>
  <body>
    <div id="root"></div>
    
    <script type="text/babel">
      const { useState, useEffect, useRef } = React;
  
      function Dashboard() {
        const [feedbackData, setFeedbackData] = useState([]);
        const [analytics, setAnalytics] = useState(null);
        const [loading, setLoading] = useState(true);
        const [filters, setFilters] = useState({ source: 'all', sentiment: 'all', urgency: 'all' });
        const [searchTerm, setSearchTerm] = useState('');
        const [darkMode, setDarkMode] = useState(false);
        
        const sentimentChartRef = useRef(null);
        const categoryChartRef = useRef(null);
        const sourceChartRef = useRef(null);
        const trendChartRef = useRef(null);
        const chartInstances = useRef({});
  
        useEffect(() => {
          loadData();
          loadAnalytics();
        }, [filters]);
  
        useEffect(() => {
          if (analytics) {
            renderCharts();
          }
          return () => {
            Object.values(chartInstances.current).forEach(chart => chart?.destroy());
          };
        }, [analytics, darkMode]);
  
        async function loadData() {
          setLoading(true);
          const params = new URLSearchParams(filters);
          const response = await fetch(\`/api/feedback?\${params}\`);
          const data = await response.json();
          setFeedbackData(data);
          setLoading(false);
        }
  
        async function loadAnalytics() {
          const response = await fetch('/api/analytics');
          const data = await response.json();
          setAnalytics(data);
        }
  
        async function initializeDB() {
          await fetch('/api/init', { method: 'POST' });
          loadData();
          loadAnalytics();
        }
  
        function renderCharts() {
          // Destroy existing charts
          Object.values(chartInstances.current).forEach(chart => chart?.destroy());
  
          const textColor = darkMode ? '#e5e7eb' : '#374151';
          const gridColor = darkMode ? '#374151' : '#e5e7eb';
          const bgColor = darkMode ? '#1f2937' : '#ffffff';
  
          // Sentiment Pie Chart
          if (sentimentChartRef.current && analytics.sentiment.length > 0) {
            const ctx = sentimentChartRef.current.getContext('2d');
            chartInstances.current.sentiment = new Chart(ctx, {
              type: 'pie',
              data: {
                labels: analytics.sentiment.map(s => s.sentiment.charAt(0).toUpperCase() + s.sentiment.slice(1)),
                datasets: [{
                  data: analytics.sentiment.map(s => s.count),
                  backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                  borderWidth: 2,
                  borderColor: bgColor
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { 
                    position: 'bottom',
                    labels: { color: textColor }
                  },
                  title: { 
                    display: true, 
                    text: 'Sentiment Distribution', 
                    font: { size: 16, weight: 'bold' },
                    color: textColor
                  }
                }
              }
            });
          }
  
          // Category Bar Chart
          if (categoryChartRef.current && analytics.categories.length > 0) {
            const ctx = categoryChartRef.current.getContext('2d');
            chartInstances.current.category = new Chart(ctx, {
              type: 'bar',
              data: {
                labels: analytics.categories.map(c => c.category),
                datasets: [{
                  label: 'Feedback Count',
                  data: analytics.categories.map(c => c.count),
                  backgroundColor: '#3b82f6',
                  borderRadius: 4
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  title: { 
                    display: true, 
                    text: 'Feedback by Category', 
                    font: { size: 16, weight: 'bold' },
                    color: textColor
                  }
                },
                scales: {
                  y: { 
                    beginAtZero: true, 
                    ticks: { stepSize: 1, color: textColor },
                    grid: { color: gridColor }
                  },
                  x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                  }
                }
              }
            });
          }
  
          // Source Distribution Doughnut Chart
          if (sourceChartRef.current && analytics.sources.length > 0) {
            const ctx = sourceChartRef.current.getContext('2d');
            chartInstances.current.source = new Chart(ctx, {
              type: 'doughnut',
              data: {
                labels: analytics.sources.map(s => s.source),
                datasets: [{
                  data: analytics.sources.map(s => s.count),
                  backgroundColor: ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#6366f1'],
                  borderWidth: 2,
                  borderColor: bgColor
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { 
                    position: 'bottom',
                    labels: { color: textColor }
                  },
                  title: { 
                    display: true, 
                    text: 'Feedback Sources', 
                    font: { size: 16, weight: 'bold' },
                    color: textColor
                  }
                }
              }
            });
          }
  
          // Trend Line Chart
          if (trendChartRef.current && analytics.trend && analytics.trend.length > 0) {
            const ctx = trendChartRef.current.getContext('2d');
            chartInstances.current.trend = new Chart(ctx, {
              type: 'line',
              data: {
                labels: analytics.trend.map(t => {
                  const date = new Date(t.date);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }),
                datasets: [{
                  label: 'Feedback Volume',
                  data: analytics.trend.map(t => t.count),
                  borderColor: '#3b82f6',
                  backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                  tension: 0.3,
                  fill: true,
                  pointRadius: 4,
                  pointHoverRadius: 6,
                  pointBackgroundColor: '#3b82f6'
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  title: { 
                    display: true, 
                    text: 'Feedback Trend (Last 7 Days)', 
                    font: { size: 16, weight: 'bold' },
                    color: textColor
                  }
                },
                scales: {
                  y: { 
                    beginAtZero: true, 
                    ticks: { stepSize: 1, color: textColor },
                    grid: { color: gridColor }
                  },
                  x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                  }
                }
              }
            });
          }
        }
  
        const filteredData = feedbackData.filter(item =>
          item.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.issue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.feedback_text?.toLowerCase().includes(searchTerm.toLowerCase())
        );
  
        return (
          <div className={\`min-h-screen p-6 \${darkMode ? 'bg-gray-900' : 'bg-gray-50'}\`}>
            <div className="max-w-7xl mx-auto">
              <div className="mb-8 flex justify-between items-center">
                <div>
                  <h1 className={\`text-3xl font-bold mb-2 \${darkMode ? 'text-white' : 'text-gray-900'}\`}>Feedback Analytics Dashboard</h1>
                  <p className={\`\${darkMode ? 'text-gray-400' : 'text-gray-600'}\`}>Powered by Cloudflare Workers + D1 + KV</p>
                </div>
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className={\`px-4 py-2 rounded-lg transition \${
                    darkMode 
                      ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }\`}
                >
                  {darkMode ? '☀️ Light' : '🌙 Dark'}
                </button>
              </div>
  
              <div className="mb-4">
                <button onClick={initializeDB} className={\`px-4 py-2 rounded transition \${
                  darkMode 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }\`}>
                  Initialize Sample Data
                </button>
              </div>
  
              {analytics && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className={\`p-6 rounded-lg shadow \${darkMode ? 'bg-gray-800' : 'bg-white'}\`}>
                      <p className={\`text-sm \${darkMode ? 'text-gray-400' : 'text-gray-600'}\`}>Total Feedback</p>
                      <p className={\`text-3xl font-bold \${darkMode ? 'text-white' : 'text-gray-900'}\`}>{analytics.total}</p>
                    </div>
                    <div className={\`p-6 rounded-lg shadow \${darkMode ? 'bg-gray-800' : 'bg-white'}\`}>
                      <p className={\`text-sm \${darkMode ? 'text-gray-400' : 'text-gray-600'}\`}>High Urgency</p>
                      <p className="text-3xl font-bold text-red-600">
                        {analytics.urgency.find(u => u.urgency === 'high')?.count || 0}
                      </p>
                    </div>
                    <div className={\`p-6 rounded-lg shadow \${darkMode ? 'bg-gray-800' : 'bg-white'}\`}>
                      <p className={\`text-sm \${darkMode ? 'text-gray-400' : 'text-gray-600'}\`}>Negative Sentiment</p>
                      <p className="text-3xl font-bold text-orange-600">
                        {analytics.sentiment.find(s => s.sentiment === 'negative')?.count || 0}
                      </p>
                    </div>
                    <div className={\`p-6 rounded-lg shadow \${darkMode ? 'bg-gray-800' : 'bg-white'}\`}>
                      <p className={\`text-sm \${darkMode ? 'text-gray-400' : 'text-gray-600'}\`}>Positive Sentiment</p>
                      <p className="text-3xl font-bold text-green-600">
                        {analytics.sentiment.find(s => s.sentiment === 'positive')?.count || 0}
                      </p>
                    </div>
                  </div>
  
                  {/* Charts Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className={\`p-6 rounded-lg shadow \${darkMode ? 'bg-gray-800' : 'bg-white'}\`}>
                      <div style={{ height: '300px' }}>
                        <canvas ref={sentimentChartRef}></canvas>
                      </div>
                    </div>
                    <div className={\`p-6 rounded-lg shadow \${darkMode ? 'bg-gray-800' : 'bg-white'}\`}>
                      <div style={{ height: '300px' }}>
                        <canvas ref={sourceChartRef}></canvas>
                      </div>
                    </div>
                    <div className={\`p-6 rounded-lg shadow \${darkMode ? 'bg-gray-800' : 'bg-white'}\`}>
                      <div style={{ height: '300px' }}>
                        <canvas ref={categoryChartRef}></canvas>
                      </div>
                    </div>
                    <div className={\`p-6 rounded-lg shadow \${darkMode ? 'bg-gray-800' : 'bg-white'}\`}>
                      <div style={{ height: '300px' }}>
                        <canvas ref={trendChartRef}></canvas>
                      </div>
                    </div>
                  </div>
                </>
              )}
  
              <div className={\`p-6 rounded-lg shadow mb-6 \${darkMode ? 'bg-gray-800' : 'bg-white'}\`}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input
                    type="text"
                    placeholder="Search feedback..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={\`px-3 py-2 border rounded-md \${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }\`}
                  />
                  <select
                    value={filters.source}
                    onChange={(e) => setFilters({...filters, source: e.target.value})}
                    className={\`px-3 py-2 border rounded-md \${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }\`}
                  >
                    <option value="all">All Sources</option>
                    <option value="Support Ticket">Support Ticket</option>
                    <option value="Discord">Discord</option>
                    <option value="GitHub Issue">GitHub Issue</option>
                    <option value="Email">Email</option>
                    <option value="Twitter">Twitter</option>
                    <option value="Community Forum">Community Forum</option>
                  </select>
                  <select
                    value={filters.sentiment}
                    onChange={(e) => setFilters({...filters, sentiment: e.target.value})}
                    className={\`px-3 py-2 border rounded-md \${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }\`}
                  >
                    <option value="all">All Sentiments</option>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </select>
                  <select
                    value={filters.urgency}
                    onChange={(e) => setFilters({...filters, urgency: e.target.value})}
                    className={\`px-3 py-2 border rounded-md \${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }\`}
                  >
                    <option value="all">All Urgency</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
  
              <div className={\`rounded-lg shadow overflow-hidden \${darkMode ? 'bg-gray-800' : 'bg-white'}\`}>
                <div className={\`px-6 py-4 border-b \${darkMode ? 'border-gray-700' : 'border-gray-200'}\`}>
                  <h3 className={\`text-lg font-semibold \${darkMode ? 'text-white' : 'text-gray-900'}\`}>Feedback Details ({filteredData.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={\`\${darkMode ? 'bg-gray-700' : 'bg-gray-50'}\`}>
                      <tr>
                        <th className={\`px-6 py-3 text-left text-xs font-medium uppercase \${darkMode ? 'text-gray-300' : 'text-gray-500'}\`}>Company</th>
                        <th className={\`px-6 py-3 text-left text-xs font-medium uppercase \${darkMode ? 'text-gray-300' : 'text-gray-500'}\`}>Source</th>
                        <th className={\`px-6 py-3 text-left text-xs font-medium uppercase \${darkMode ? 'text-gray-300' : 'text-gray-500'}\`}>Issue</th>
                        <th className={\`px-6 py-3 text-left text-xs font-medium uppercase \${darkMode ? 'text-gray-300' : 'text-gray-500'}\`}>Category</th>
                        <th className={\`px-6 py-3 text-left text-xs font-medium uppercase \${darkMode ? 'text-gray-300' : 'text-gray-500'}\`}>Sentiment</th>
                        <th className={\`px-6 py-3 text-left text-xs font-medium uppercase \${darkMode ? 'text-gray-300' : 'text-gray-500'}\`}>Urgency</th>
                      </tr>
                    </thead>
                    <tbody className={\`divide-y \${darkMode ? 'divide-gray-700' : 'divide-gray-200'}\`}>
                      {filteredData.map((item, i) => (
                        <tr key={i} className={\`\${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}\`}>
                          <td className={\`px-6 py-4 text-sm \${darkMode ? 'text-gray-200' : 'text-gray-900'}\`}>{item.company}</td>
                          <td className={\`px-6 py-4 text-sm \${darkMode ? 'text-gray-300' : 'text-gray-600'}\`}>{item.source}</td>
                          <td className={\`px-6 py-4 text-sm max-w-xs truncate \${darkMode ? 'text-gray-300' : 'text-gray-600'}\`}>{item.issue}</td>
                          <td className={\`px-6 py-4 text-sm \${darkMode ? 'text-gray-300' : 'text-gray-600'}\`}>{item.category}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={\`px-2 py-1 rounded-full text-xs font-medium \${
                              item.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                              item.sentiment === 'neutral' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }\`}>
                              {item.sentiment}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={\`px-2 py-1 rounded-full text-xs font-medium \${
                              item.urgency === 'high' ? 'bg-red-100 text-red-800' :
                              item.urgency === 'medium' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }\`}>
                              {item.urgency}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      }
  
      ReactDOM.render(<Dashboard />, document.getElementById('root'));
    </script>
  </body>
  </html>`;
  }