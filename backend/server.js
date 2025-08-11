import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables only in development
// In production (Vercel), use environment variables from dashboard
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '../.env' });
}

const app = express();
const PORT = process.env.PORT || 3001;

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
  // Connected to database
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Middleware - flexible CORS for development
app.use((req, res, next) => {
  next();
});

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Allow all localhost origins in development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow Vercel domains in production
    if (origin.includes('vercel.app') || origin.includes('vercel.com')) {
      return callback(null, true);
    }
    
    return callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json());

// Utility functions
const calculateSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
};

const billingualKeywords = {
  'moisturizer': ['pelembap', 'moisturizer', 'moisturiser'],
  'cleanser': ['pembersih', 'cleanser'],
  'serum': ['serum'],
  'cream': ['krim', 'cream'],
  'oil': ['minyak', 'oil'],
  'mask': ['masker', 'mask'],
  'toner': ['toner'],
  'lotion': ['losyen', 'lotion'],
  'soap': ['sabun', 'soap'],
  'shampoo': ['syampu', 'shampoo'],
  'conditioner': ['pelembap rambut', 'conditioner'],
  'lipstick': ['gincu', 'lipstick'],
  'foundation': ['asas', 'foundation'],
  'powder': ['bedak', 'powder'],
  'perfume': ['minyak wangi', 'perfume', 'perfum'],
  'deodorant': ['deodoran', 'deodorant'],
  'skincare': ['penjagaan kulit', 'skincare', 'skin care'],
  'makeup': ['solekan', 'makeup', 'make-up', 'kosmetik'],
  'haircare': ['penjagaan rambut', 'haircare', 'hair care'],
  'bodycare': ['penjagaan badan', 'bodycare', 'body care'],
  'fragrance': ['minyak wangi', 'fragrance', 'perfume'],
  'beauty': ['kecantikan', 'beauty'],
  'natural': ['semula jadi', 'natural'],
  'organic': ['organik', 'organic'],
  'whitening': ['pemutih', 'whitening', 'pencerah'],
  'anti-aging': ['anti-penuaan', 'anti-aging', 'anti-ageing']
};

const expandSearchQuery = (query) => {
  const queryLower = query.toLowerCase();
  const expandedTerms = new Set([queryLower]);
  
  Object.entries(billingualKeywords).forEach(([english, translations]) => {
    translations.forEach(term => {
      if (queryLower.includes(term) || term.includes(queryLower)) {
        translations.forEach(t => expandedTerms.add(t));
        expandedTerms.add(english);
      }
    });
  });
  
  return Array.from(expandedTerms);
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CosmeticGuard API is running' });
});

// Get all products (limited for performance)
app.get('/api/products', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT p.notif_no, p.date_notif, p.status, p.product, p.category,
             c.company_name as company, c.reliability_score
      FROM categorized_products p
      JOIN companies c ON p.company_id = c.company_id
      ORDER BY p.date_notif DESC
      LIMIT 10000
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('getProducts failed:', err);
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  } finally {
    client.release();
  }
});

// FIXED: Real-time search with suggestions
app.get('/api/search/realtime', async (req, res) => {
  const { query, limit = 10 } = req.query;
  
  if (!query || query.length < 3) {
    return res.json([]);
  }

  const client = await pool.connect();
  try {
    const expandedTerms = expandSearchQuery(query);
    
    // Build parameters array first
    const params = [];
    expandedTerms.forEach(term => {
      params.push(`%${term}%`, `%${term}%`, `%${term}%`);
    });
    params.push(parseInt(limit)); // Add limit as last parameter
    
    // Build search conditions with proper parameter placeholders
    const searchConditions = expandedTerms.map((term, index) => {
      const baseIndex = index * 3;
      return `(p.product ILIKE $${baseIndex + 1} OR c.company_name ILIKE $${baseIndex + 2} OR p.notif_no ILIKE $${baseIndex + 3})`;
    }).join(' OR ');
    
    const limitParam = `$${params.length}`; // Use the correct parameter number for LIMIT

    const result = await client.query(`
      SELECT p.notif_no, p.date_notif, p.status, p.product, p.category,
             c.company_name as company, c.reliability_score
      FROM categorized_products p
      JOIN companies c ON p.company_id = c.company_id
      WHERE ${searchConditions}
      ORDER BY p.date_notif DESC
      LIMIT ${limitParam}
    `, params);
    
    const resultsWithSimilarity = result.rows.map(product => ({
      ...product,
      similarity: Math.max(
        calculateSimilarity(query.toLowerCase(), product.product?.toLowerCase() || ''),
        calculateSimilarity(query.toLowerCase(), product.company?.toLowerCase() || ''),
        calculateSimilarity(query.toLowerCase(), product.notif_no?.toLowerCase() || '')
      )
    }));

    const filteredResults = resultsWithSimilarity
      .filter(item => item.similarity > 0.1)
      .sort((a, b) => b.similarity - a.similarity);
    
    res.json(filteredResults);
  } catch (err) {
    console.error('Real-time search failed:', err);
    res.status(500).json({ error: 'Search failed', details: err.message });
  } finally {
    client.release();
  }
});

// FIXED: Enhanced search with substances (using direct database calls instead of HTTP)
app.get('/api/search/enhanced', async (req, res) => {
  const { query, page = 1, limit = 50 } = req.query;
  
  if (!query) {
    return res.json({ products: [], totalCount: 0, currentPage: 1, totalPages: 0 });
  }

  const client = await pool.connect();
  try {
    
    // Get search results directly from database (instead of HTTP call)
    const expandedTerms = expandSearchQuery(query);
    
    // Build parameters array
    const params = [];
    expandedTerms.forEach(term => {
      params.push(`%${term}%`, `%${term}%`, `%${term}%`);
    });
    
    // Add pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page
    const offset = (pageNum - 1) * limitNum;
    
    params.push(limitNum, offset);
    
    // Build search conditions with proper parameter placeholders
    const searchConditions = expandedTerms.map((term, index) => {
      const baseIndex = index * 3;
      return `(p.product ILIKE $${baseIndex + 1} OR c.company_name ILIKE $${baseIndex + 2} OR p.notif_no ILIKE $${baseIndex + 3})`;
    }).join(' OR ');
    
    const limitParam = `$${params.length - 1}`;
    const offsetParam = `$${params.length}`;

    // First get total count
    const countResult = await client.query(`
      SELECT COUNT(DISTINCT p.notif_no) as total
      FROM categorized_products p
      JOIN companies c ON p.company_id = c.company_id
      LEFT JOIN cancelled_product_substances cps ON p.notif_no = cps.notif_no AND p.status = 'cancelled'
      LEFT JOIN substances s ON cps.substance_id = s.substance_id
      LEFT JOIN cancelled_products cp ON p.notif_no = cp.notif_no AND p.status = 'cancelled'
      WHERE ${searchConditions}
    `, params.slice(0, -2)); // Remove limit and offset params for count query

    // Then get paginated results
    const result = await client.query(`
      SELECT DISTINCT p.notif_no, p.date_notif, p.status, p.product, p.category,
             c.company_name as company, c.reliability_score,
             STRING_AGG(DISTINCT s.substance, '|') as harmful_substances,
             cp.manufacturer
      FROM categorized_products p
      JOIN companies c ON p.company_id = c.company_id
      LEFT JOIN cancelled_product_substances cps ON p.notif_no = cps.notif_no AND p.status = 'cancelled'
      LEFT JOIN substances s ON cps.substance_id = s.substance_id
      LEFT JOIN cancelled_products cp ON p.notif_no = cp.notif_no AND p.status = 'cancelled'
      WHERE ${searchConditions}
      GROUP BY p.notif_no, p.date_notif, p.status, p.product, p.category, c.company_name, c.reliability_score, cp.manufacturer
      ORDER BY p.date_notif DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, params);
    
    const totalCount = parseInt(countResult.rows[0]?.total || 0);
    const totalPages = Math.ceil(totalCount / limitNum);
    
    if (!result.rows || result.rows.length === 0) {
      return res.json({ 
        products: [], 
        totalCount, 
        currentPage: pageNum, 
        totalPages,
        hasNextPage: false,
        hasPrevPage: false
      });
    }
    
    // Process the results to format harmful_ingredients properly
    const enhancedProducts = result.rows.map(product => {
      const harmful_ingredients = product.harmful_substances 
        ? product.harmful_substances.split('|').filter(s => s && s.trim()) 
        : [];
      
      return {
        notif_no: product.notif_no,
        date_notif: product.date_notif,
        status: product.status,
        product: product.product,
        category: product.category,
        company: product.company,
        reliability_score: product.reliability_score,
        harmful_ingredients: harmful_ingredients,
        manufacturer: product.manufacturer || product.company
      };
    });
    
    res.json({
      products: enhancedProducts,
      totalCount,
      currentPage: pageNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    });
  } catch (error) {
    console.error('Enhanced search failed:', error);
    res.status(500).json({ error: 'Enhanced search failed', details: error.message });
  } finally {
    client.release();
  }
});

// Get alternative products
app.get('/api/alternatives/:notifNo', async (req, res) => {
  const { notifNo } = req.params;
  const { limit = 5 } = req.query;
  
  const client = await pool.connect();
  try {
    // First get the original product details
    const originalResult = await client.query(`
      SELECT p.category, p.product
      FROM categorized_products p
      WHERE p.notif_no = $1
    `, [notifNo]);
    
    if (originalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Original product not found' });
    }
    
    const originalProduct = originalResult.rows[0];
    
    const result = await client.query(`
      SELECT p.notif_no, p.date_notif, p.status, p.product, p.category,
             c.company_name as company, c.reliability_score
      FROM categorized_products p
      JOIN companies c ON p.company_id = c.company_id
      WHERE p.category = $1 
        AND p.status = 'approved'
        AND p.notif_no != $2
      ORDER BY c.reliability_score DESC
      LIMIT $3
    `, [originalProduct.category, notifNo, parseInt(limit)]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('getAlternativeProducts failed:', err);
    res.status(500).json({ error: 'Failed to get alternatives', details: err.message });
  } finally {
    client.release();
  }
});

// Get product by notification number
app.get('/api/product/:notifNo', async (req, res) => {
  const { notifNo } = req.params;
  
  const client = await pool.connect();
  try {
    console.log('Fetching product:', notifNo);
    
    const result = await client.query(`
      SELECT p.notif_no, p.date_notif, p.status, p.product, p.category,
             c.company_name as company, c.reliability_score
      FROM categorized_products p
      JOIN companies c ON p.company_id = c.company_id
      WHERE p.notif_no = $1
    `, [notifNo]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    console.log('Product fetched:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getProduct failed:', err);
    res.status(500).json({ error: 'Failed to get product', details: err.message });
  } finally {
    client.release();
  }
});

// Get all ingredients/substances
app.get('/api/ingredients', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Fetching ingredients...');
    
    const result = await client.query(`
      SELECT substance_id, substance as substance_detected, common_name, 
             health_effect, international_ban_status, risk_level,
             risk_level_definition, simple_explain, short_risk, long_risk,
             usage, alternative, banned_year
      FROM substances
      ORDER BY 
        CASE risk_level 
          WHEN 'HIGH' THEN 1 
          WHEN 'MEDIUM' THEN 2 
          WHEN 'LOW' THEN 3 
          ELSE 4 
        END,
        substance
    `);
    
    console.log('Ingredients fetched:', result.rows?.length, 'records');
    res.json(result.rows);
  } catch (err) {
    console.error('getIngredients failed:', err);
    res.status(500).json({ error: 'Failed to get ingredients', details: err.message });
  } finally {
    client.release();
  }
});

// Get brand statistics
app.get('/api/brands', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Fetching brand stats...');
    
    const result = await client.query(`
      SELECT company_name as brand, num_approved as product_approved, 
             num_cancelled as product_cancelled, reliability_score,
             cancel_score, category_score, portfolio_score, market_score,
             time_bonus, exp_penalty
      FROM companies
      ORDER BY reliability_score DESC
    `);
    
    const processedData = result.rows.map(brand => {
      const approvedProducts = parseInt(brand.product_approved) || 0;
      const cancelledProducts = parseInt(brand.product_cancelled) || 0;
      const totalProducts = approvedProducts + cancelledProducts;
      
      let cancellationRate = 0;
      if (totalProducts > 0) {
        cancellationRate = (cancelledProducts / totalProducts) * 100;
        cancellationRate = Math.round(cancellationRate * 100) / 100;
      }
      
      return {
        ...brand,
        product_approved: approvedProducts,
        product_cancelled: cancelledProducts,
        total_products: totalProducts,
        cancellation_rate: cancellationRate
      };
    });
    
    console.log('Brand stats fetched:', processedData?.length, 'records');
    res.json(processedData);
  } catch (err) {
    console.error('getBrandStats failed:', err);
    res.status(500).json({ error: 'Failed to get brand stats', details: err.message });
  } finally {
    client.release();
  }
});

// Get cancelled products
app.get('/api/cancelled', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Fetching cancelled products...');
    
    const result = await client.query(`
      SELECT cp.notif_no, cp.manufacturer,
             array_agg(s.substance) as substances
      FROM cancelled_products cp
      LEFT JOIN cancelled_product_substances cps ON cp.notif_no = cps.notif_no
      LEFT JOIN substances s ON cps.substance_id = s.substance_id
      GROUP BY cp.notif_no, cp.manufacturer
      ORDER BY cp.notif_no
    `);
    
    console.log('Cancelled products fetched:', result.rows?.length, 'records');
    res.json(result.rows);
  } catch (err) {
    console.error('getCancelledProducts failed:', err);
    res.status(500).json({ error: 'Failed to get cancelled products', details: err.message });
  } finally {
    client.release();
  }
});

// Get cancelled product by notification number
app.get('/api/cancelled/:notifNo', async (req, res) => {
  const { notifNo } = req.params;
  
  const client = await pool.connect();
  try {
    console.log('Fetching cancelled product:', notifNo);
    
    const result = await client.query(`
      SELECT notif_no, manufacturer
      FROM cancelled_products
      WHERE notif_no = $1
    `, [notifNo]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cancelled product not found' });
    }
    
    console.log('Cancelled product fetched:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getCancelledProduct failed:', err);
    res.status(500).json({ error: 'Failed to get cancelled product', details: err.message });
  } finally {
    client.release();
  }
});

// Get harmful substances for a product
app.get('/api/substances/product/:notifNo', async (req, res) => {
  const { notifNo } = req.params;
  
  const client = await pool.connect();
  try {
    console.log('Fetching harmful substances for:', notifNo);
    
    const result = await client.query(`
      SELECT s.substance_id, s.substance, s.common_name, s.risk_level,
             s.health_effect, s.simple_explain, s.short_risk, s.long_risk
      FROM cancelled_product_substances cps
      JOIN substances s ON cps.substance_id = s.substance_id
      WHERE cps.notif_no = $1
      ORDER BY 
        CASE s.risk_level 
          WHEN 'HIGH' THEN 1 
          WHEN 'MEDIUM' THEN 2 
          WHEN 'LOW' THEN 3 
          ELSE 4 
        END
    `, [notifNo]);
    
    console.log('Harmful substances fetched:', result.rows?.length, 'substances');
    res.json(result.rows);
  } catch (err) {
    console.error('getHarmfulSubstances failed:', err);
    res.status(500).json({ error: 'Failed to get harmful substances', details: err.message });
  } finally {
    client.release();
  }
});

// Get score breakdown for a brand
app.get('/api/brands/score/:brandName', async (req, res) => {
  const { brandName } = req.params;
  
  const client = await pool.connect();
  try {
    console.log('Fetching score breakdown for brand:', brandName);
    
    const result = await client.query(`
      SELECT company_name as brand, reliability_score, cancel_score as cancellation_score,
             category_score, portfolio_score as stability_score, market_score as presence_score,
             time_bonus, exp_penalty, num_approved, num_cancelled,
             (cancel_score * 0.4 + category_score * 0.25 + portfolio_score * 0.2 + market_score * 0.15) as base_score,
             (time_bonus + exp_penalty) as bonuses_penalties
      FROM companies
      WHERE company_name ILIKE $1
    `, [`%${brandName}%`]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Brand score breakdown not found' });
    }
    
    const breakdown = result.rows[0];
    breakdown.brand_age_years = 2.5;
    breakdown.has_recent_products = true;
    breakdown.has_old_products = true;
    
    console.log('Score breakdown fetched:', breakdown);
    res.json(breakdown);
  } catch (err) {
    console.error('getScoreBreakdown failed:', err);
    res.status(500).json({ error: 'Failed to get score breakdown', details: err.message });
  } finally {
    client.release();
  }
});

// Get recent approved products
app.get('/api/products/recent', async (req, res) => {
  const { limit = 10 } = req.query;
  
  const client = await pool.connect();
  try {
    console.log('Fetching recent approved products...');
    
    const result = await client.query(`
      SELECT p.notif_no, p.date_notif, p.status, p.product, p.category,
             c.company_name as company, c.reliability_score
      FROM categorized_products p
      JOIN companies c ON p.company_id = c.company_id
      WHERE p.status = 'approved'
      ORDER BY p.date_notif DESC
      LIMIT $1
    `, [parseInt(limit)]);
    
    console.log('Recent approved products fetched:', result.rows.length, 'records');
    res.json(result.rows);
  } catch (err) {
    console.error('getRecentApprovedProducts failed:', err);
    res.status(500).json({ error: 'Failed to get recent products', details: err.message });
  } finally {
    client.release();
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`CosmeticGuard API server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });

  // Cleanup on process exit
  process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await pool.end();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down server...');
    await pool.end();
    process.exit(0);
  });
}

// Export for Vercel
export default app;