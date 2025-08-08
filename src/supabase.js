import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Fuzzy search implementation
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

// Bilingual keyword mapping for search
const billingualKeywords = {
  // Product types
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
  
  // Categories
  'skincare': ['penjagaan kulit', 'skincare', 'skin care'],
  'makeup': ['solekan', 'makeup', 'make-up', 'kosmetik'],
  'haircare': ['penjagaan rambut', 'haircare', 'hair care'],
  'bodycare': ['penjagaan badan', 'bodycare', 'body care'],
  'fragrance': ['minyak wangi', 'fragrance', 'perfume'],
  
  // Common terms
  'beauty': ['kecantikan', 'beauty'],
  'natural': ['semula jadi', 'natural'],
  'organic': ['organik', 'organic'],
  'whitening': ['pemutih', 'whitening', 'pencerah'],
  'anti-aging': ['anti-penuaan', 'anti-aging', 'anti-ageing']
};

// Expand search query with bilingual terms
const expandSearchQuery = (query) => {
  const queryLower = query.toLowerCase();
  const expandedTerms = new Set([queryLower]);
  
  // Add bilingual equivalents
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

// Database service functions with enhanced search
export const cosmetics = {
  // Get all products from your Products table (limited for performance)
  async getProducts() {
    try {
      console.log('Fetching products (limited for performance)...');
      
      // Just fetch a reasonable sample for search functionality
      const { data, error } = await supabase
        .from('Products')
        .select('*')
        .order('date_notif', { ascending: false })
        .limit(10000) // Reasonable limit for search functionality
      
      if (error) {
        console.error('Products query error:', error);
        throw error;
      }
      
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
      
      // Expand query with bilingual terms
      const expandedTerms = expandSearchQuery(query);
      
      // Create OR conditions for all expanded terms
      const orConditions = expandedTerms.map(term => 
        `product.ilike.%${term}%,company.ilike.%${term}%,notif_no.ilike.%${term}%`
      ).join(',');

      const { data, error } = await supabase
        .from('Products')
        .select('*')
        .or(orConditions)
        .order('date_notif', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Real-time search error:', error);
        throw error;
      }
      
      // Add similarity scores for ranking
      const resultsWithSimilarity = data.map(product => ({
        ...product,
        similarity: Math.max(
          calculateSimilarity(query.toLowerCase(), product.product?.toLowerCase() || ''),
          calculateSimilarity(query.toLowerCase(), product.company?.toLowerCase() || ''),
          calculateSimilarity(query.toLowerCase(), product.notif_no?.toLowerCase() || '')
        )
      }));

      // Sort by similarity and filter out very low matches
      const filteredResults = resultsWithSimilarity
        .filter(item => item.similarity > 0.1)
        .sort((a, b) => b.similarity - a.similarity);
      
      console.log('Real-time search completed:', filteredResults.length, 'results');
      return filteredResults;
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
      
      const { data, error } = await supabase
        .from('Products')
        .select('*')
        .eq('category', originalProduct.category)
        .eq('status', 'approved')
        .neq('notif_no', originalProduct.notif_no)
        .order('reliability_score', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Alternative products query error:', error);
        throw error;
      }
      
      console.log('Alternative products found:', data?.length, 'records');
      return data || [];
    } catch (err) {
      console.error('getAlternativeProducts failed:', err);
      throw err;
    }
  },

  // Enhanced search that includes cancelled product info
  async searchProductsWithSubstances(query) {
    try {
      console.log('Enhanced search for:', query);
      
      // First try real-time search
      let products = await this.searchProductsRealtime(query, 200);
      
      // If no results, try fuzzy search
      if (products.length === 0) {
        products = await this.fuzzySearch(query, 20);
      }
      
      if (!products || products.length === 0) {
        console.log('No products found for query:', query);
        return [];
      }
      
      // For cancelled products, get their harmful substances
      const enhancedProducts = await Promise.all(
        products.map(async (product) => {
          if (product.status === 'cancelled') {
            try {
              const cancelledInfo = await this.getCancelledProduct(product.notif_no);
              if (cancelledInfo) {
                // Extract non-empty substances
                const substances = [
                  cancelledInfo.substance_1,
                  cancelledInfo.substance_2, 
                  cancelledInfo.substance_3
                ].filter(s => s && s !== 'EMPTY' && s.trim() !== '');
                
                return {
                  ...product,
                  harmful_ingredients: substances,
                  manufacturer: cancelledInfo.manufacturer
                };
              }
            } catch (err) {
              console.warn(`No cancelled product info for ${product.notif_no}`);
            }
          }
          return {
            ...product,
            harmful_ingredients: []
          };
        })
      );
      
      console.log('Enhanced search completed:', enhancedProducts.length, 'results');
      return enhancedProducts;
    } catch (error) {
      console.error('Enhanced search failed:', error);
      throw error;
    }
  },

  // Search products by name, company, or notification number
  async searchProducts(query) {
    try {
      console.log('Searching products for:', query);
      const { data, error } = await supabase
        .from('Products')
        .select('*')
        .or(`product.ilike.%${query}%,company.ilike.%${query}%,notif_no.ilike.%${query}%`)
        .order('date_notif', { ascending: false })
      
      if (error) {
        console.error('Search query error:', error);
        throw error;
      }
      
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
      const { data, error } = await supabase
        .from('Products')
        .select('*')
        .eq('notif_no', notifNo)
        .single()
      
      if (error) {
        console.error('Get product error:', error);
        throw error;
      }
      
      console.log('Product fetched:', data);
      return data;
    } catch (err) {
      console.error('getProduct failed:', err);
      throw err;
    }
  },

  // Get all substances from your Substances table
  async getIngredients() {
    try {
      console.log('Fetching ingredients...');
      const { data, error } = await supabase
        .from('Substances')
        .select('*')
        .order('substance_detected')
      
      if (error) {
        console.error('Ingredients query error:', error);
        throw error;
      }
      
      console.log('Ingredients fetched successfully:', data?.length, 'records');
      return data;
    } catch (err) {
      console.error('getIngredients failed:', err);
      throw err;
    }
  },

  // Get brand statistics from your Brand table with corrected calculations
  async getBrandStats() {
    try {
      console.log('Fetching brand stats...');
      const { data, error } = await supabase
        .from('Brand')
        .select('*')
        .order('cancellation_rate', { ascending: false })
      
      if (error) {
        console.error('Brand stats query error:', error);
        throw error;
      }
      
      // Process and fix the brand statistics with proper rounding
      const processedData = data.map(brand => {
        const approvedProducts = parseInt(brand.product_approved) || 0;
        const cancelledProducts = parseInt(brand.product_cancelled) || 0;
        const totalProducts = approvedProducts + cancelledProducts;
        
        // Calculate cancellation rate properly with rounding
        let cancellationRate = 0;
        if (totalProducts > 0) {
          cancellationRate = (cancelledProducts / totalProducts) * 100;
          cancellationRate = Math.round(cancellationRate * 100) / 100; // Round to 2 decimal places
        }
        
        return {
          ...brand,
          product_approved: approvedProducts,
          product_cancelled: cancelledProducts,
          total_products: totalProducts,
          cancellation_rate: cancellationRate
        };
      });
      
      console.log('Brand stats fetched and processed successfully:', processedData?.length, 'records');
      return processedData;
    } catch (err) {
      console.error('getBrandStats failed:', err);
      throw err;
    }
  },

  // Get cancelled products with their harmful substances
  async getCancelledProducts() {
    try {
      console.log('Fetching cancelled products...');
      const { data, error } = await supabase
        .from('Cancelled_product')
        .select('*')
      
      if (error) {
        console.error('Cancelled products query error:', error);
        throw error;
      }
      
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
      const { data, error } = await supabase
        .from('Cancelled_product')
        .select('*')
        .eq('notif_no', notifNo)
        .single()
      
      if (error) {
        // Not all products have cancelled product records, so this might fail
        console.warn('No cancelled product info for:', notifNo, error.message);
        return null;
      }
      
      console.log('Cancelled product fetched:', data);
      return data;
    } catch (err) {
      console.warn('getCancelledProduct failed (this is normal for approved products):', err);
      return null;
    }
  },

  // Get detailed score breakdown from Result table
  async getScoreBreakdown(brandName) {
    try {
      console.log('Fetching score breakdown for brand:', brandName);
      const { data, error } = await supabase
        .from('Result')
        .select('*')
        .eq('brand', brandName)
        .single()
      
      if (error) {
        console.warn('No score breakdown for brand:', brandName, error.message);
        return null;
      }
      
      console.log('Score breakdown fetched:', data);
      return data;
    } catch (err) {
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
      
      // Strategy 1: Exact match
      let { data, error } = await supabase
        .from('Result')
        .select('*')
        .eq('brand', brandName)
        .single()
      
      if (!error && data) {
        console.log('Found exact match for score breakdown:', data);
        return data;
      }
      
      // Strategy 2: Case insensitive match
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('Result')
        .select('*')
        .ilike('brand', brandName)
        .limit(1)
        .single()
      
      if (!fallbackError && fallbackData) {
        console.log('Found case-insensitive match for score breakdown:', fallbackData);
        return fallbackData;
      }

      // Strategy 3: Partial match (contains)
      const { data: partialData, error: partialError } = await supabase
        .from('Result')
        .select('*')
        .ilike('brand', `%${brandName}%`)
        .limit(1)

      if (!partialError && partialData && partialData.length > 0) {
        console.log('Found partial match for score breakdown:', partialData[0]);
        return partialData[0];
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
      
      // First, let's try to get recent products without status filter to see what we have
      const { data: allRecentData, error: allError } = await supabase
        .from('Products')
        .select('*')
        .order('date_notif', { ascending: false })
        .limit(20) // Get more to filter from
      
      if (allError) {
        console.error('All recent products query error:', allError);
        throw allError;
      }
      
      console.log('Recent products sample (first 5):');
      allRecentData.slice(0, 5).forEach((product, idx) => {
        console.log(`${idx + 1}. ${product.product} - Status: "${product.status}" - Date: ${product.date_notif}`);
      });
      
      // Filter for approved products (case insensitive)
      const approvedProducts = allRecentData.filter(product => 
        product.status && product.status.toLowerCase() === 'approved'
      ).slice(0, limit);
      
      console.log(`Found ${approvedProducts.length} approved products out of ${allRecentData.length} recent products`);
      
      // If we don't have enough approved products, get the most recent ones regardless of status
      if (approvedProducts.length < 5) {
        console.log('Not enough approved products, showing recent products regardless of status');
        return allRecentData.slice(0, limit);
      }
      
      return approvedProducts;
    } catch (err) {
      console.error('getRecentApprovedProducts failed:', err);
      throw err;
    }
  }
}