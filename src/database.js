// Frontend database service that communicates with backend API
// In production, use relative /api path. In development, use localhost:3001
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// For production on Vercel, if API_BASE_URL is relative, prepend the origin
const getFullApiUrl = (endpoint) => {
  if (API_BASE_URL.startsWith('/')) {
    // Relative URL - use same origin (for production)
    return `${window.location.origin}${API_BASE_URL}${endpoint}`;
  }
  // Absolute URL - use as is (for development)
  return `${API_BASE_URL}${endpoint}`;
};

// Configuration logging
console.log('Frontend API Configuration:');
console.log('   API Base URL:', API_BASE_URL);
console.log('   Frontend Origin:', window.location.origin);
console.log('   Environment:', import.meta.env.MODE);

// Utility functions (keep these for compatibility)
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

// HTTP request helper with enhanced error handling
const apiRequest = async (endpoint, options = {}) => {
  try {
    console.log(`Making API request: ${endpoint}`);
    
    const fullUrl = getFullApiUrl(endpoint);
    const response = await fetch(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`API request successful: ${endpoint}`);
    return data;
  } catch (error) {
    // Enhanced error messages for common issues
    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      const fullUrl = getFullApiUrl(endpoint);
      console.error(`Backend server not reachable at ${fullUrl}`);
      
      // Different messages for production vs development
      if (import.meta.env.MODE === 'production') {
        console.error('Backend API error in production. Please check server logs.');
      } else {
        console.error('To fix this:');
        console.error('   1. Make sure backend is running: npm run dev:backend');
        console.error('   2. Check backend is on port 3001: http://localhost:3001/api/health');
        console.error('   3. Or run both together: npm run dev:full');
      }
      throw new Error('Backend server not reachable. Please check the server status.');
    }
    
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
};

// Database service functions - now using HTTP API
export const cosmetics = {
  // Get all products from categorized_products table (limited for performance)
  async getProducts() {
    try {
      console.log('Fetching products (limited for performance)...');
      const data = await apiRequest('/products');
      console.log('Products sample fetched successfully:', data?.length, 'records (for search functionality)');
      console.log('Note: Full database contains 200K+ products, hero will show hardcoded count');
      return data;
    } catch (err) {
      console.error('getProducts failed:', err);
      throw err;
    }
  },

  // Enhanced search with real-time suggestions and fuzzy matching
  async searchProductsRealtime(query, limit = 10) {
    try {
      if (!query || query.length < 3) {
        return [];
      }

      console.log('Real-time search for:', query);
      const params = new URLSearchParams({ query, limit: limit.toString() });
      const data = await apiRequest(`/search/realtime?${params}`);
      
      console.log('Real-time search completed:', data.length, 'results');
      return data;
    } catch (err) {
      console.error('searchProductsRealtime failed:', err);
      throw err;
    }
  },

  // Fuzzy search with suggestions for misspelled queries
  async fuzzySearch(query, suggestionLimit = 5) {
    try {
      console.log('Fuzzy search for:', query);
      
      // Get all products for fuzzy matching
      const allProducts = await this.getProducts();
      
      // Calculate similarity for all products
      const fuzzyMatches = allProducts.map(product => {
        const productSimilarity = calculateSimilarity(query.toLowerCase(), product.product?.toLowerCase() || '');
        const companySimilarity = calculateSimilarity(query.toLowerCase(), product.company?.toLowerCase() || '');
        const notifSimilarity = calculateSimilarity(query.toLowerCase(), product.notif_no?.toLowerCase() || '');
        
        return {
          ...product,
          similarity: Math.max(productSimilarity, companySimilarity, notifSimilarity),
          matchType: productSimilarity >= companySimilarity && productSimilarity >= notifSimilarity ? 'product' :
                     companySimilarity >= notifSimilarity ? 'company' : 'notification'
        };
      });

      // Filter and sort by similarity
      const suggestions = fuzzyMatches
        .filter(item => item.similarity > 0.4)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, suggestionLimit);

      console.log('Fuzzy search completed:', suggestions.length, 'suggestions');
      return suggestions;
    } catch (err) {
      console.error('fuzzySearch failed:', err);
      throw err;
    }
  },

  // Get alternative products in same category (for cancelled/high-risk products)
  async getAlternativeProducts(originalProduct, limit = 5) {
    try {
      console.log('Finding alternatives for:', originalProduct.product);
      const params = new URLSearchParams({ limit: limit.toString() });
      const data = await apiRequest(`/alternatives/${originalProduct.notif_no}?${params}`);
      
      console.log('Alternative products found:', data?.length, 'records');
      return data || [];
    } catch (err) {
      console.error('getAlternativeProducts failed:', err);
      throw err;
    }
  },

  // Enhanced search that includes cancelled product info with harmful substances
  async searchProductsWithSubstances(query, page = 1, limit = 50) {
    try {
      console.log('Enhanced search for:', query, 'page:', page);
      const params = new URLSearchParams({ query, page: page.toString(), limit: limit.toString() });
      const data = await apiRequest(`/search/enhanced?${params}`);
      
      console.log('Enhanced search completed:', data.products?.length || 0, 'results,', data.totalCount, 'total');
      return data;
    } catch (error) {
      console.error('Enhanced search failed:', error);
      throw error;
    }
  },

  // Search products by name, company, or notification number
  async searchProducts(query) {
    try {
      console.log('Searching products for:', query);
      const params = new URLSearchParams({ query });
      const data = await apiRequest(`/search/realtime?${params}`);
      
      console.log('Search completed:', data?.length, 'results found');
      return data;
    } catch (err) {
      console.error('searchProducts failed:', err);
      throw err;
    }
  },

  // Get product by notification number
  async getProduct(notifNo) {
    try {
      console.log('Fetching product:', notifNo);
      const data = await apiRequest(`/product/${notifNo}`);
      
      console.log('Product fetched:', data);
      return data;
    } catch (err) {
      console.error('getProduct failed:', err);
      throw err;
    }
  },

  // Get all substances from substances table with new detailed structure
  async getIngredients() {
    try {
      console.log('Fetching ingredients...');
      const data = await apiRequest('/ingredients');
      
      console.log('Ingredients fetched successfully:', data?.length, 'records');
      return data;
    } catch (err) {
      console.error('getIngredients failed:', err);
      throw err;
    }
  },

  // Get brand statistics from companies table with new reliability scoring
  async getBrandStats() {
    try {
      console.log('Fetching brand stats...');
      const data = await apiRequest('/brands');
      
      console.log('Brand stats fetched and processed successfully:', data?.length, 'records');
      return data;
    } catch (err) {
      console.error('getBrandStats failed:', err);
      throw err;
    }
  },

  // Get cancelled products with their harmful substances from new structure
  async getCancelledProducts() {
    try {
      console.log('Fetching cancelled products...');
      const data = await apiRequest('/cancelled');
      
      console.log('Cancelled products fetched successfully:', data?.length, 'records');
      return data;
    } catch (err) {
      console.error('getCancelledProducts failed:', err);
      throw err;
    }
  },

  // Get cancelled product by notification number
  async getCancelledProduct(notifNo) {
    try {
      console.log('Fetching cancelled product:', notifNo);
      const data = await apiRequest(`/cancelled/${notifNo}`);
      
      console.log('Cancelled product fetched:', data);
      return data;
    } catch (err) {
      if (err.message.includes('404')) {
        console.warn('No cancelled product info for:', notifNo);
        return null;
      }
      console.warn('getCancelledProduct failed (this is normal for approved products):', err);
      return null;
    }
  },

  // Get harmful substances for a cancelled product
  async getHarmfulSubstances(notifNo) {
    try {
      console.log('Fetching harmful substances for:', notifNo);
      const data = await apiRequest(`/substances/product/${notifNo}`);
      
      console.log('Harmful substances fetched:', data?.length, 'substances');
      return data;
    } catch (err) {
      console.error('getHarmfulSubstances failed:', err);
      return [];
    }
  },

  // Get detailed score breakdown from companies table
  async getScoreBreakdown(brandName) {
    try {
      console.log('Fetching score breakdown for brand:', brandName);
      const data = await apiRequest(`/brands/score/${encodeURIComponent(brandName)}`);
      
      console.log('Score breakdown fetched:', data);
      return data;
    } catch (err) {
      if (err.message.includes('404')) {
        console.warn('No score breakdown for brand:', brandName);
        return null;
      }
      console.warn('getScoreBreakdown failed:', err);
      return null;
    }
  },

  // Get score breakdown by brand with fallback search strategies
  async getScoreBreakdownWithFallback(brandName) {
    try {
      if (!brandName) {
        console.log('No brand name provided for score breakdown');
        return null;
      }

      console.log('Fetching score breakdown for brand with fallback:', brandName);
      
      // Try exact match first
      let breakdown = await this.getScoreBreakdown(brandName);
      
      if (breakdown) {
        console.log('Found breakdown data:', breakdown);
        return breakdown;
      }
      
      console.warn('No score breakdown found for brand:', brandName);
      return null;
    } catch (err) {
      console.warn('getScoreBreakdownWithFallback failed:', err);
      return null;
    }
  },

  // Get the 10 most recent approved products for homepage display
  async getRecentApprovedProducts(limit = 10) {
    try {
      console.log('Fetching recent approved products for homepage...');
      const params = new URLSearchParams({ limit: limit.toString() });
      const data = await apiRequest(`/products/recent?${params}`);
      
      console.log(`Found ${data.length} approved products`);
      return data;
    } catch (err) {
      console.error('getRecentApprovedProducts failed:', err);
      throw err;
    }
  },

  // Enhanced health check for API connection
  async healthCheck() {
    try {
      console.log('Checking backend health...');
      const data = await apiRequest('/health');
      console.log('Backend API health check:', data);
      return data;
    } catch (err) {
      console.error('Backend API health check failed:', err.message);
      // Provide helpful error context
      if (err.message.includes('Backend server not reachable')) {
        console.error('Backend server is not running or not accessible');
        console.error('Check: http://localhost:3001/api/health in your browser');
      }
      throw err;
    }
  }
}

// Test connection on module load
cosmetics.healthCheck().then(data => {
  console.log('Backend connection successful:', data.message);
}).catch(err => {
  console.error('Backend connection failed:', err.message);
  console.error('');
  console.error('Quick Fix Steps:');
  console.error('   1. Open a new terminal');
  console.error('   2. Run: npm run dev:backend');
  console.error('   3. Wait for "CosmeticGuard API server running" message');
  console.error('   4. Refresh this page');
  console.error('');
  console.error('Or run both frontend and backend:');
  console.error('   npm run dev:full');
  console.error('');
});

export default cosmetics;
