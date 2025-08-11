import React, { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, CheckCircle, XCircle, Shield, AlertCircle, Loader2, X, Mail, ExternalLink, Info, Filter, ArrowLeftRight, Bookmark, BookmarkCheck, ArrowUp, ArrowDown } from 'lucide-react';
import { cosmetics } from './database';
import './App.css';

// Debounce function for search
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const CosmeticSafetyApp = () => {
  const [activeTab, setActiveTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [unfilteredResultsCount, setUnfilteredResultsCount] = useState(0);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [alternativeProducts, setAlternativeProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Modal states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalData, setStatusModalData] = useState(null);
  const [showNoResultsModal, setShowNoResultsModal] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [showScoreExplanation, setShowScoreExplanation] = useState(false);
  
  // Data states
  const [products, setProducts] = useState([]);
  const [cancelledProducts, setCancelledProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [brandStats, setBrandStats] = useState([]);
  const [recentApprovedProducts, setRecentApprovedProducts] = useState([]);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all', // 'all', 'approved', 'cancelled'
    riskLevel: 'all', // 'all', 'low', 'medium', 'high'
    category: 'all',
    harmfulIngredients: 'all' // 'all', 'exclude', 'only'
  });
  
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  
  // Search type state
  const [searchType, setSearchType] = useState('all'); // 'all', 'company', 'product', 'notification'
  const [showSearchTypeDropdown, setShowSearchTypeDropdown] = useState(false);
  
  // Brand search and sort states
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [brandSortBy, setBrandSortBy] = useState('totalProducts'); // 'totalProducts', 'approvedProducts', 'cancelledProducts', 'cancellationRate'
  const [brandSortDirection, setBrandSortDirection] = useState('desc'); // 'asc' or 'desc'
  
  // Ingredient search and sort states
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState('');
  const [ingredientSortBy, setIngredientSortBy] = useState('risk'); // 'risk', 'name', 'bannedYear'
  const [ingredientSortDirection, setIngredientSortDirection] = useState('desc'); // 'asc' or 'desc'
  
  // Product search sort states
  const [productSortBy, setProductSortBy] = useState('score'); // 'score', 'name', 'brand', 'status', 'date'
  const [productSortDirection, setProductSortDirection] = useState('desc'); // 'asc' or 'desc'
  
  // Ingredient modal state
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  
  // Saved alternatives state
  const [savedAlternatives, setSavedAlternatives] = useState([]);
  const [showSavedAlternatives, setShowSavedAlternatives] = useState(false);
  
  // Search history state
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);

  // Score calculation data state
  const [scoreCalculationData, setScoreCalculationData] = useState(null);
  const [actualScoreBreakdown, setActualScoreBreakdown] = useState(null);

  // Brand warning state
  const [brandHistory, setBrandHistory] = useState(null);
  const [showBrandWarning, setShowBrandWarning] = useState(false);
  const [brandWarningLoading, setBrandWarningLoading] = useState(false);

  // Brand history cache for Brand Safety tab
  const [brandHistoryCache, setBrandHistoryCache] = useState({});
  const [brandWarningsLoaded, setBrandWarningsLoaded] = useState(false);
  const [brandWarningsLoading, setBrandWarningsLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12); // Increased for better grid layouts
  
  // Backend pagination state
  const [searchPage, setSearchPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalSearchPages, setTotalSearchPages] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [itemsPerSearchPage] = useState(100); // Backend pagination limit
  
  // Brand pagination state
  const [brandCurrentPage, setBrandCurrentPage] = useState(1);
  const [brandItemsPerPage] = useState(30); // 30 brands per page for better performance
  
  // Responsive state variables
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  const [paginationStrategy, setPaginationStrategy] = useState('adaptive'); // 'fixed', 'adaptive', 'smart'


  // Load initial data
  useEffect(() => {
    loadInitialData();
    loadSavedAlternatives();
    loadSearchHistory();
  }, []);

  // Load filter preferences from localStorage after component mounts (client-side only)
  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem('cosmeticGuard_filterPreferences');
      if (savedFilters) {
        const parsedFilters = JSON.parse(savedFilters);
        setFilters(parsedFilters);
      }
    } catch (error) {
      // Failed to load filter preferences - using defaults
    }
    setFiltersLoaded(true);
  }, []);

  // Save filter preferences to localStorage whenever filters change (only after initial load)
  useEffect(() => {
    if (!filtersLoaded) return; // Don't save during initial load
    
    try {
      localStorage.setItem('cosmeticGuard_filterPreferences', JSON.stringify(filters));
    } catch (error) {
      // Failed to save filter preferences
    }
  }, [filters, filtersLoaded]);

  // Auto-refilter existing search results when filters change
  useEffect(() => {
    if (!filtersLoaded) return; // Don't filter during initial load
    
    // Only refilter if we have existing search results
    if (searchResults.length > 0 || unfilteredResultsCount > 0) {
      // Get all unfiltered results by searching again with current query
      if (searchQuery.trim()) {
        handleSearch(searchQuery, false); // false = don't save to history again
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, filtersLoaded]); // Only depend on filters and filtersLoaded to avoid infinite loops

  // Viewport tracking for responsive behavior
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSearchTypeDropdown && !event.target.closest('.search-type-dropdown')) {
        setShowSearchTypeDropdown(false);
      }
      if (showSuggestions && !event.target.closest('.search-input-container')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchTypeDropdown, showSuggestions]);

  // Load brand histories when Brand Safety tab is activated
  useEffect(() => {
    if (activeTab === 'brands' && brandStats.length > 0) {
      loadBrandHistoriesForTab();
    }
  }, [activeTab, brandStats]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Clear product cache when loading new data
      if (productCache.current) {
        productCache.current.clear();
      }
      
      const productsData = await cosmetics.getProducts();
      setProducts(productsData || []);

      // Load cancelled products for accurate count
      const cancelledData = await cosmetics.getCancelledProducts();
      setCancelledProducts(cancelledData || []);

      const ingredientsData = await cosmetics.getIngredients();
      setIngredients(ingredientsData || []);

      const brandStatsData = await cosmetics.getBrandStats();
      setBrandStats(brandStatsData || []);

      const recentApprovedData = await cosmetics.getRecentApprovedProducts(10);
      setRecentApprovedProducts(recentApprovedData || []);

    } catch (err) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load saved alternatives from memory
  const loadSavedAlternatives = () => {
    // In a real app, this would be from localStorage, but since we can't use it,
    // we'll manage it in component state
    setSavedAlternatives([]);
  };

  // Load search history from localStorage
  const loadSearchHistory = () => {
    try {
      const savedHistory = localStorage.getItem('cosmeticGuard_searchHistory');
      if (savedHistory) {
        setSearchHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      // Failed to load search history
    }
  };

  // Save search to history
  const saveSearchToHistory = (query, resultsCount) => {
    if (!query.trim()) return;
    
    const newSearch = {
      id: Date.now(),
      query: query.trim(),
      resultsCount,
      timestamp: new Date().toISOString(),
      searchType
    };
    
    setSearchHistory(prev => {
      // Remove duplicate searches and keep only last 20
      const filtered = prev.filter(item => item.query.toLowerCase() !== query.toLowerCase());
      const updated = [newSearch, ...filtered].slice(0, 20);
      
      // Save to localStorage
      try {
        localStorage.setItem('cosmeticGuard_searchHistory', JSON.stringify(updated));
      } catch (error) {
        // Failed to save search history
      }
      
      return updated;
    });
  };

  // Clear search history
  const clearSearchHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem('cosmeticGuard_searchHistory');
    } catch (error) {
      // Failed to clear search history
    }
  };

  // Repeat search from history
  const repeatSearch = (historyItem) => {
    setSearchQuery(historyItem.query);
    setSearchType(historyItem.searchType || 'all');
    setShowSearchHistory(false);
    // Trigger search
    setTimeout(() => {
      handleSearch();
    }, 100);
  };

  // Save alternative product
  const saveAlternative = (product) => {
    const isAlreadySaved = savedAlternatives.some(alt => alt.notif_no === product.notif_no);
    if (!isAlreadySaved) {
      setSavedAlternatives(prev => [...prev, product]);
    }
  };

  // Remove from saved alternatives
  const removeSavedAlternative = (notifNo) => {
    setSavedAlternatives(prev => prev.filter(alt => alt.notif_no !== notifNo));
  };

  // Reset to fresh homepage (preserves filter preferences)
  const resetToHomepage = () => {
    setActiveTab('search');
    setSearchQuery('');
    setSearchResults([]);
    setUnfilteredResultsCount(0);
    setSelectedProduct(null);
    setAlternativeProducts([]);
    setShowSuggestions(false);
    setSearchType('all');
    setShowSearchTypeDropdown(false);
    setShowScoreExplanation(false);
    setScoreCalculationData(null);
    setActualScoreBreakdown(null);
    setBrandHistory(null);
    setShowBrandWarning(false);
    setBrandWarningLoading(false);
    setBrandHistoryCache({});
    setBrandWarningsLoaded(false);
    setBrandWarningsLoading(false);
    setCurrentPage(1);
    setBrandCurrentPage(1); // Reset brand pagination
    // Note: Filters are preserved to remember user preferences
    setShowFilters(false);
    setShowSavedAlternatives(false);
    setShowSearchHistory(false);
    setBrandSearchQuery(''); // Reset brand search
    setBrandSortDirection('desc'); // Reset brand sort direction
    setIngredientSearchQuery(''); // Reset ingredient search
    setIngredientSortDirection('desc'); // Reset ingredient sort direction
    setProductSortBy('score'); // Reset product sort
    setProductSortDirection('desc'); // Reset product sort direction
  };

  // Filter and sort brand data
  const getFilteredAndSortedBrands = () => {
    let filteredBrands = brandStats;
    
    // Apply search filter
    if (brandSearchQuery.trim()) {
      const query = brandSearchQuery.toLowerCase();
      filteredBrands = filteredBrands.filter(brand => 
        brand.brand.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    const sortedBrands = [...filteredBrands].sort((a, b) => {
      const aFormatted = formatBrandStat(a);
      const bFormatted = formatBrandStat(b);
      
      let comparison = 0;
      switch (brandSortBy) {
        case 'totalProducts':
          comparison = bFormatted.totalProducts - aFormatted.totalProducts;
          break;
        case 'approvedProducts':
          comparison = bFormatted.approvedProducts - aFormatted.approvedProducts;
          break;
        case 'cancelledProducts':
          comparison = bFormatted.cancelledProducts - aFormatted.cancelledProducts;
          break;
        case 'cancellationRate':
          comparison = bFormatted.cancellationRate - aFormatted.cancellationRate;
          break;
        default:
          comparison = bFormatted.totalProducts - aFormatted.totalProducts;
      }
      
      // Apply sort direction
      return brandSortDirection === 'asc' ? -comparison : comparison;
    });
    
    return sortedBrands;
  };

  // Filter and sort ingredient data
  const getFilteredAndSortedIngredients = () => {
    let filteredIngredients = ingredients;
    
    // Apply search filter
    if (ingredientSearchQuery.trim()) {
      const query = ingredientSearchQuery.toLowerCase();
      filteredIngredients = filteredIngredients.filter(ingredient => 
        ingredient.substance_detected?.toLowerCase().includes(query) ||
        ingredient.common_name?.toLowerCase().includes(query) ||
        ingredient.health_effect?.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    const sortedIngredients = [...filteredIngredients].sort((a, b) => {
      const aFormatted = formatIngredient(a);
      const bFormatted = formatIngredient(b);
      
      let comparison = 0;
      switch (ingredientSortBy) {
        case 'risk': {
          // Risk level sorting: high -> medium -> low
          const riskOrder = { 'high': 3, 'medium': 2, 'low': 1 };
          const aRisk = riskOrder[aFormatted.risk] || 0;
          const bRisk = riskOrder[bFormatted.risk] || 0;
          comparison = bRisk - aRisk;
          break;
        }
        case 'name':
          comparison = (aFormatted.name || '').localeCompare(bFormatted.name || '');
          break;
        case 'bannedYear': {
          const aYear = parseInt(aFormatted.bannedYear) || 0;
          const bYear = parseInt(bFormatted.bannedYear) || 0;
          comparison = bYear - aYear;
          break;
        }
        default:
          comparison = (aFormatted.name || '').localeCompare(bFormatted.name || '');
      }
      
      // Apply sort direction
      return ingredientSortDirection === 'asc' ? -comparison : comparison;
    });
    
    return sortedIngredients;
  };

  // Filter and sort product search results
  const getFilteredAndSortedProducts = (results) => {
    if (!results || results.length === 0) {
      return [];
    }
    
    // Apply sorting
    const sortedProducts = [...results].sort((a, b) => {
      const aFormatted = formatProduct(a);
      const bFormatted = formatProduct(b);
      
      let comparison = 0;
      switch (productSortBy) {
        case 'score':
          comparison = (bFormatted.riskScore || 0) - (aFormatted.riskScore || 0);
          break;
        case 'name':
          comparison = (aFormatted.name || '').localeCompare(bFormatted.name || '');
          break;
        case 'brand':
          comparison = (aFormatted.brand || '').localeCompare(bFormatted.brand || '');
          break;
        case 'status': {
          // Approved first, then cancelled
          const statusOrder = { 'approved': 2, 'cancelled': 1 };
          const aStatus = statusOrder[aFormatted.status] || 0;
          const bStatus = statusOrder[bFormatted.status] || 0;
          comparison = bStatus - aStatus;
          break;
        }
        case 'date': {
          const aDate = aFormatted.approvalDate ? new Date(aFormatted.approvalDate) : new Date(0);
          const bDate = bFormatted.approvalDate ? new Date(bFormatted.approvalDate) : new Date(0);
          comparison = bDate - aDate; // Newest first
          break;
        }
        default:
          comparison = (bFormatted.riskScore || 0) - (aFormatted.riskScore || 0);
      }
      
      // Apply sort direction
      return productSortDirection === 'asc' ? -comparison : comparison;
    });
    
    return sortedProducts;
  };

  // Apply filters to search results
  const applyFilters = (results) => {
    if (!results || results.length === 0) {
      return [];
    }

    const filteredResults = results.filter(product => {
      const formattedProduct = formatProduct(product);
      
      // Status filter
      if (filters.status !== 'all') {
        const productStatus = formattedProduct.status?.toLowerCase();
        if (productStatus !== filters.status) {
          return false;
        }
      }
      
      // Risk level filter
      if (filters.riskLevel !== 'all') {
        const riskLevel = getRiskLevel(formattedProduct.riskScore);
        if (riskLevel !== filters.riskLevel) {
          return false;
        }
      }
      
      // Category filter
      if (filters.category !== 'all') {
        const productCategory = formattedProduct.category;
        if (!productCategory || productCategory !== filters.category) {
          return false;
        }
      }
      
      // Harmful ingredients filter
      if (filters.harmfulIngredients !== 'all') {
        const hasHarmfulIngredients = formattedProduct.harmfulIngredients && 
                                      Array.isArray(formattedProduct.harmfulIngredients) && 
                                      formattedProduct.harmfulIngredients.length > 0;
        if (filters.harmfulIngredients === 'exclude' && hasHarmfulIngredients) {
          return false;
        }
        if (filters.harmfulIngredients === 'only' && !hasHarmfulIngredients) {
          return false;
        }
      }
      
      return true;
    });

    return filteredResults;
  };

  // Get unique categories for filter dropdown
  const getUniqueCategories = () => {
    const categories = products.map(p => p.category).filter(Boolean);
    return [...new Set(categories)];
  };

  // Enhanced search with real-time suggestions and fuzzy matching based on search type
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length >= 3) {
        try {
          const suggestions = await cosmetics.searchProductsRealtime(query, 5);
          setSearchSuggestions(suggestions);
          setShowSuggestions(true);
        } catch (err) {
          setSearchSuggestions([]);
        }
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300),
    []
  );

  // Get search type label
  const getSearchTypeLabel = () => {
    switch (searchType) {
      case 'company': return 'Search by Company';
      case 'product': return 'Search by Product Name';
      case 'notification': return 'Search by Notification Number';
      default: return 'Search All Fields';
    }
  };

  // Get search placeholder
  const getSearchPlaceholder = () => {
    switch (searchType) {
      case 'company': return 'e.g., LA MAISON DU SAVON DE MARSEILLE';
      case 'product': return 'e.g., La Maison Du Savon De Marseille 100g';
      case 'notification': return 'e.g., NOT200706378K';
      default: return 'e.g., La Maison Du Savon, pelembap, NOT200706378K';
    }
  };

  // Show ingredient details modal
  const showIngredientDetails = (ingredientName) => {
    const ingredient = ingredients.find(ing => 
      (ing.substance_detected || ing.substance || '').toString().toUpperCase() === ingredientName.toString().toUpperCase()
    );
    if (ingredient) {
      setSelectedIngredient(formatIngredient(ingredient));
      setShowIngredientModal(true);
    }
  };

  // Handle search input change
  const handleSearchInputChange = (value) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  // Main search function with search type support
  const handleSearch = async (query = searchQuery, saveToHistory = true) => {
    const searchTerm = query.trim();
    if (!searchTerm) {
      setSearchResults([]);
      setUnfilteredResultsCount(0);
      setCurrentPage(1);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setShowSuggestions(false);
      setCurrentPage(1);
      setSearchPage(1);
      
      const searchResponse = await cosmetics.searchProductsWithSubstances(searchTerm, 1, itemsPerSearchPage);
      
      // Handle pagination metadata
      if (searchResponse.totalCount !== undefined) {
        setTotalCount(searchResponse.totalCount);
        setTotalSearchPages(searchResponse.totalPages);
        setHasNextPage(searchResponse.hasNextPage);
        setHasPrevPage(searchResponse.hasPrevPage);
      }
      
      let results = searchResponse.products || searchResponse; // Handle both old and new response formats
      
      // Apply search type filtering
      if (results && searchType !== 'all') {
        results = results.filter(product => {
          switch (searchType) {
            case 'company':
              return product.company?.toLowerCase().includes(searchTerm.toLowerCase());
            case 'product':
              return product.product?.toLowerCase().includes(searchTerm.toLowerCase());
            case 'notification':
              return product.notif_no?.toLowerCase().includes(searchTerm.toLowerCase());
            default:
              return true;
          }
        });
      }
      
      if (results && results.length > 0) {
        // Store unfiltered count for display purposes
        setUnfilteredResultsCount(results.length);
        
        const filteredResults = applyFilters(results);
        
        if (filteredResults.length > 0) {
          setSearchResults(filteredResults);
          setSelectedProduct(null);
          // Save search to history
          if (saveToHistory) {
            saveSearchToHistory(searchTerm, filteredResults.length);
          }
        } else {
          setSearchResults([]);
          // Save search to history even if no results after filtering
          if (saveToHistory) {
            saveSearchToHistory(searchTerm, 0);
          }
        }
      } else {
        setUnfilteredResultsCount(0);
        setSearchResults([]);
        setShowNoResultsModal(true);
      }
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load more search results (pagination)
  const loadMoreResults = async () => {
    if (!hasNextPage || loading) return;
    
    try {
      setLoading(true);
      const nextPage = searchPage + 1;
      const searchResponse = await cosmetics.searchProductsWithSubstances(searchQuery, nextPage, itemsPerSearchPage);
      
      let newResults = searchResponse.products || searchResponse;
      
      // Apply search type filtering to new results
      if (newResults && searchType !== 'all') {
        newResults = newResults.filter(product => {
          switch (searchType) {
            case 'company':
              return product.company?.toLowerCase().includes(searchQuery.toLowerCase());
            case 'product':
              return product.product?.toLowerCase().includes(searchQuery.toLowerCase());
            case 'notification':
              return product.notif_no?.toLowerCase().includes(searchQuery.toLowerCase());
            default:
              return true;
          }
        });
      }
      
      if (newResults && newResults.length > 0) {
        const filteredNewResults = applyFilters(newResults);
        
        // Append new results to existing ones
        setSearchResults(prev => [...prev, ...filteredNewResults]);
        setUnfilteredResultsCount(prev => prev + newResults.length);
        
        // Update pagination state
        setSearchPage(nextPage);
        setHasNextPage(searchResponse.hasNextPage);
        setHasPrevPage(searchResponse.hasPrevPage);
      }
    } catch (err) {
      setError(`Failed to load more results: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion) => {
    setSearchQuery(suggestion.product);
    setShowSuggestions(false);
    const filteredResults = applyFilters([suggestion]);
    setSearchResults(filteredResults);
    setUnfilteredResultsCount(1);
    setSelectedProduct(null);
  };

  // Handle product selection and load alternatives (AC1.4.1)
  const handleProductSelect = async (product) => {
    const formattedProduct = formatProduct(product);
    setSelectedProduct(formattedProduct);
    
    // Load brand history for harmful ingredients warning
    if (formattedProduct.brand) {
      setBrandWarningLoading(true);
      setShowBrandWarning(false);
      try {
        const history = await cosmetics.getBrandHistory(formattedProduct.brand);
        setBrandHistory(history);
        console.log('Brand history loaded:', history);
      } catch (err) {
        console.warn('Failed to load brand history:', err);
        setBrandHistory(null);
      } finally {
        setBrandWarningLoading(false);
      }
    } else {
      setBrandHistory(null);
    }
    
    // Load alternative products if this is cancelled or high-risk
    if (formattedProduct.status === 'cancelled' || formattedProduct.riskScore <= 40) {
      try {
        const alternatives = await cosmetics.getAlternativeProducts(product, 5);
        setAlternativeProducts(alternatives);
      } catch (err) {
        setAlternativeProducts([]);
      }
    } else {
      setAlternativeProducts([]);
    }
  };

  // Load brand histories for Brand Safety tab
  const loadBrandHistoriesForTab = async () => {
    if (brandWarningsLoaded || brandWarningsLoading || brandStats.length === 0) {
      return;
    }

    setBrandWarningsLoading(true);
    try {
      // Only load histories for brands with cancelled products to optimize performance
      const brandsWithCancellations = brandStats.filter(brand => {
        const cancelledCount = parseInt(brand.product_cancelled || brand.cancelledProducts || 0);
        return cancelledCount > 0;
      });

      console.log(`Loading brand histories for ${brandsWithCancellations.length} brands with cancellations...`);
      
      // Load histories in parallel with controlled concurrency
      const historyPromises = brandsWithCancellations.map(async (brand) => {
        try {
          const brandName = brand.brand || brand.company_name || brand.brand_name;
          if (!brandName) return null;

          const history = await cosmetics.getBrandHistory(brandName);
          return { brandName, history };
        } catch (err) {
          console.warn(`Failed to load history for brand: ${brand.brand}`, err);
          return null;
        }
      });

      const results = await Promise.all(historyPromises);
      
      // Build cache object
      const newCache = {};
      results.forEach(result => {
        if (result && result.brandName) {
          newCache[result.brandName] = result.history;
        }
      });

      setBrandHistoryCache(newCache);
      setBrandWarningsLoaded(true);
      console.log('Brand histories loaded for Brand Safety tab:', Object.keys(newCache).length);
    } catch (err) {
      console.error('Failed to load brand histories:', err);
    } finally {
      setBrandWarningsLoading(false);
    }
  };

  // Show comparison modal (US 3.2)
  const showComparison = (originalProduct, alternativeProduct) => {
    setComparisonData({
      original: typeof originalProduct.id !== 'undefined' ? originalProduct : formatProduct(originalProduct),
      alternative: formatProduct(alternativeProduct)
    });
    setShowComparisonModal(true);
  };

  // Show status explanation modal (AC1.2.3)
  const showStatusExplanation = (product) => {
    // Clear cache for this specific product to ensure fresh data
    const cacheKey = product.notif_no;
    if (productCache.current.has(cacheKey)) {
      productCache.current.delete(cacheKey);
    }
    
    // Always format the clicked product to ensure we show the correct data
    const formattedProduct = formatProduct(product);
    
    setStatusModalData({
      product: formattedProduct,
      status: formattedProduct.status,
      riskScore: formattedProduct.riskScore,
      harmfulIngredients: formattedProduct.harmfulIngredients
    });
    setShowStatusModal(true);
  };

  // Product cache to ensure consistency
  const productCache = React.useRef(new Map());

  // Convert database fields to display format
  const formatProduct = (product) => {
    // Check cache first to ensure consistency
    const cacheKey = product.notif_no;
    if (productCache.current.has(cacheKey)) {
      return productCache.current.get(cacheKey);
    }
    
    // Calculate risk score with comprehensive field checking
    let riskScore = 0;
    
    // Check multiple possible field names for reliability score
    const possibleScoreFields = [
      product.reliability_score,
      product.riskScore, 
      product.risk_score,
      product.score
    ];
    
    const validScore = possibleScoreFields.find(score => 
      score !== null && score !== undefined && !isNaN(score)
    );
    
    if (validScore !== undefined) {
      riskScore = Math.round(Number(validScore) * 10) / 10; // Round to 1 decimal place
    } else {
      // This should rarely happen if database always has reliability_score
      if (product.status?.toLowerCase() === 'approved') {
        riskScore = 80.0; // Fixed fallback for approved
      } else if (product.status?.toLowerCase() === 'cancelled') {
        riskScore = 30.0; // Fixed fallback for cancelled
      } else {
        riskScore = 50.0;
      }
    }
    
    const formatted = {
      id: product.notif_no,
      name: product.product,
      brand: product.company,
      notificationNumber: product.notif_no,
      status: product.status?.toLowerCase() || 'unknown',
      cancellationDate: null,
      approvalDate: product.date_notif,
      cancellationReason: null,
      harmfulIngredients: product.harmful_ingredients || [],
      category: product.category,
      riskScore: riskScore,
      lastUpdated: product.date_notif ? new Date(product.date_notif).toLocaleDateString() : 'Unknown',
      manufacturer: product.manufacturer || product.company,
      _originalProduct: product // Keep reference for debugging
    };
    
    // Cache the formatted product with size limit
    const MAX_CACHE_SIZE = 1000;
    if (productCache.current.size >= MAX_CACHE_SIZE) {
      // Remove oldest entries when cache gets too large
      const firstKey = productCache.current.keys().next().value;
      productCache.current.delete(firstKey);
    }
    productCache.current.set(cacheKey, formatted);
    
    return formatted;
  };

  const formatIngredient = (ingredient) => ({
    name: (ingredient.substance_detected || ingredient.substance || '').toString().toUpperCase(),
    risk: ingredient.risk_level?.toLowerCase() || 'medium',
    effects: ingredient.health_effect,
    commonName: ingredient.common_name,
    banStatus: ingredient.international_ban_status,
    riskDefinition: ingredient.risk_level_definition,
    usage: ingredient.usage,
    alternative: ingredient.alternative,
    bannedYear: ingredient.banned_year,
    longRisk: ingredient.long_risk,
    simpleExplanation: ingredient.simple_explain,
    shortRisk: ingredient.short_risk
  });

  const formatBrandStat = (stat) => {
    const totalProducts = (parseInt(stat.product_approved) || 0) + (parseInt(stat.product_cancelled) || 0);
    const cancelledProducts = parseInt(stat.product_cancelled) || 0;
    const approvedProducts = parseInt(stat.product_approved) || 0;
    
    // Fix the cancellation rate calculation with proper rounding
    let cancellationRate = 0;
    if (totalProducts > 0) {
      cancellationRate = (cancelledProducts / totalProducts) * 100;
      cancellationRate = Math.round(cancellationRate * 100) / 100; // Round to 2 decimal places
    }
    
    return {
      brand: stat.brand,
      totalProducts: totalProducts,
      cancelledProducts: cancelledProducts,
      approvedProducts: approvedProducts,
      cancellationRate: cancellationRate
    };
  };

  // Format large numbers for display
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    const numValue = Number(num);
    if (numValue >= 1000000) return (numValue / 1000000).toFixed(1) + 'M';
    if (numValue >= 1000) return (numValue / 1000).toFixed(1) + 'K';
    return numValue.toString();
  };

  const getRiskLevel = (score) => {
    if (score <= 40) return 'high';
    if (score <= 70) return 'medium';
    return 'low';
  };

  const getRiskText = (score) => {
    if (score <= 40) return 'High Risk';
    if (score <= 70) return 'Medium Risk';
    return 'Low Risk';
  };

  const getStatusIcon = (status) => {
    if (status === 'approved') return <CheckCircle style={{ width: '20px', height: '20px', color: '#10b981' }} />;
    if (status === 'cancelled') return <XCircle style={{ width: '20px', height: '20px', color: '#ef4444' }} />;
    return <AlertCircle style={{ width: '20px', height: '20px', color: '#6b7280' }} />;
  };

  const getBrandRiskLevel = (rate) => {
    if (rate > 20) return 'high-risk';
    if (rate > 10) return 'medium-risk';
    return 'low-risk';
  };

  const getBrandIcon = (rate) => {
    if (rate > 20) return <AlertTriangle style={{ width: '24px', height: '24px', color: '#dc2626' }} />;
    if (rate > 10) return <AlertCircle style={{ width: '24px', height: '24px', color: '#d97706' }} />;
    return <CheckCircle style={{ width: '24px', height: '24px', color: '#059669' }} />;
  };

  // Strategy 1: Adaptive items per page based on screen width and grid columns
  const getAdaptiveItemsPerPage = () => {
    // Calculate grid columns based on CSS breakpoints
    const gridColumns = viewportWidth > 1400 ? 4 : 
                       viewportWidth > 1000 ? 3 : 
                       viewportWidth > 700 ? 2 : 1;
    
    // Base items per page
    const baseItemsPerPage = 12;
    const rowsPerPage = Math.ceil(baseItemsPerPage / gridColumns);
    
    // Ensure complete rows
    return rowsPerPage * gridColumns;
  };

  // Strategy 2: Smart distribution to minimize empty spaces on last page
  const getSmartItemsPerPage = () => {
    const baseItemsPerPage = itemsPerPage;
    const totalItems = searchResults.length;
    
    if (totalItems <= baseItemsPerPage) return totalItems;
    
    const totalPages = Math.ceil(totalItems / baseItemsPerPage);
    const itemsOnLastPage = totalItems % baseItemsPerPage;
    
    // If last page has too few items (less than 30% of full page), redistribute
    if (itemsOnLastPage > 0 && itemsOnLastPage < baseItemsPerPage * 0.3) {
      // Calculate optimal items per page to avoid tiny last page
      const optimalPerPage = Math.ceil(totalItems / (totalPages - 1));
      return Math.max(optimalPerPage, 6); // Minimum 6 items per page
    }
    
    return baseItemsPerPage;
  };

  // Get current items per page based on selected strategy
  const getCurrentItemsPerPage = () => {
    switch (paginationStrategy) {
      case 'adaptive': return getAdaptiveItemsPerPage();
      case 'smart': return getSmartItemsPerPage();
      default: return itemsPerPage;
    }
  };

  // Pagination functions
  const getPaginatedResults = () => {
    const sortedResults = getFilteredAndSortedProducts(searchResults);
    const actualItemsPerPage = getCurrentItemsPerPage();
    const startIndex = (currentPage - 1) * actualItemsPerPage;
    const endIndex = startIndex + actualItemsPerPage;
    return sortedResults.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    const sortedResults = getFilteredAndSortedProducts(searchResults);
    const actualItemsPerPage = getCurrentItemsPerPage();
    return Math.ceil(sortedResults.length / actualItemsPerPage);
  };

  // Handle page change with smooth scrolling
  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= getTotalPages() && pageNumber !== currentPage) {
      setCurrentPage(pageNumber);
      
      // Smooth scroll to results with better targeting
      setTimeout(() => {
        const targetElement = document.querySelector('.results-container') || 
                            document.querySelector('.products-grid') ||
                            document.querySelector('.search-results');
        
        if (targetElement) {
          const yOffset = -20; // Offset for header
          const y = targetElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 50);
    }
  };

  // Get page numbers with mobile support
  const getPageNumbers = () => {
    const totalPages = getTotalPages();
    const pageNumbers = [];
    
    // Adjust max visible pages based on screen size
    const maxVisible = viewportWidth > 768 ? 7 : viewportWidth > 480 ? 5 : 3;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      const halfVisible = Math.floor(maxVisible / 2);
      
      if (currentPage <= halfVisible + 1) {
        // Near beginning
        for (let i = 1; i <= maxVisible - 2; i++) pageNumbers.push(i);
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - halfVisible) {
        // Near end
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = totalPages - maxVisible + 3; i <= totalPages; i++) pageNumbers.push(i);
      } else {
        // In middle
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pageNumbers.push(i);
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };

  // Brand pagination functions
  const getBrandPaginatedResults = () => {
    const filteredBrands = getFilteredAndSortedBrands();
    const startIndex = (brandCurrentPage - 1) * brandItemsPerPage;
    const endIndex = startIndex + brandItemsPerPage;
    return filteredBrands.slice(startIndex, endIndex);
  };

  const getBrandTotalPages = () => {
    const filteredBrands = getFilteredAndSortedBrands();
    return Math.ceil(filteredBrands.length / brandItemsPerPage);
  };

  // Handle brand page change with smooth scrolling
  const handleBrandPageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= getBrandTotalPages() && pageNumber !== brandCurrentPage) {
      setBrandCurrentPage(pageNumber);
      
      // Smooth scroll to brands section
      setTimeout(() => {
        const targetElement = document.querySelector('.brands-grid') || 
                            document.querySelector('.brand-safety-content');
        
        if (targetElement) {
          const yOffset = -100; // Offset for header and controls
          const y = targetElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 50);
    }
  };

  // Get brand page numbers with mobile support
  const getBrandPageNumbers = () => {
    const totalPages = getBrandTotalPages();
    const pageNumbers = [];
    
    // Adjust max visible pages based on screen size
    const maxVisible = viewportWidth > 768 ? 7 : viewportWidth > 480 ? 5 : 3;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      const halfVisible = Math.floor(maxVisible / 2);
      
      if (brandCurrentPage <= halfVisible + 1) {
        // Near beginning
        for (let i = 1; i <= maxVisible - 2; i++) pageNumbers.push(i);
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      } else if (brandCurrentPage >= totalPages - halfVisible) {
        // Near end
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = totalPages - maxVisible + 3; i <= totalPages; i++) pageNumbers.push(i);
      } else {
        // In middle
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = brandCurrentPage - 1; i <= brandCurrentPage + 1; i++) pageNumbers.push(i);
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };

  // Brand Pagination Component
  const BrandPaginationComponent = () => {
    const totalPages = getBrandTotalPages();
    const filteredBrandsLength = getFilteredAndSortedBrands().length;
    const startIndex = (brandCurrentPage - 1) * brandItemsPerPage;
    const endIndex = Math.min(startIndex + brandItemsPerPage, filteredBrandsLength);
    
    if (totalPages <= 1) return null;
    
    return (
      <div className="pagination-container">
        {/* Pagination info with responsive text */}
        <div className="pagination-info">
          <span>
            Showing <strong>{startIndex + 1}-{endIndex}</strong> of <strong>{filteredBrandsLength}</strong> brands
          </span>
        </div>

        {/* Pagination controls */}
        <div className="pagination-controls">
          {/* Previous Button */}
          <button
            className="pagination-button"
            onClick={() => handleBrandPageChange(brandCurrentPage - 1)}
            disabled={brandCurrentPage === 1}
            aria-label="Previous page"
          >
            <ArrowUp style={{ width: '16px', height: '16px', transform: 'rotate(-90deg)' }} />
            <span style={{ display: viewportWidth > 640 ? 'inline' : 'none' }}>Previous</span>
          </button>

          {/* Page Numbers */}
          {getBrandPageNumbers().map((pageNum, idx) => (
            <button
              key={idx}
              className={`pagination-button ${pageNum === brandCurrentPage ? 'active' : ''}`}
              onClick={() => typeof pageNum === 'number' ? handleBrandPageChange(pageNum) : null}
              disabled={pageNum === '...'}
              aria-label={typeof pageNum === 'number' ? `Go to page ${pageNum}` : 'More pages'}
            >
              {pageNum === '...' ? (
                '...'
              ) : (
                pageNum
              )}
            </button>
          ))}

          {/* Next Button */}
          <button
            className="pagination-button"
            onClick={() => handleBrandPageChange(brandCurrentPage + 1)}
            disabled={brandCurrentPage === totalPages}
            aria-label="Next page"
          >
            <span style={{ display: viewportWidth > 640 ? 'inline' : 'none' }}>Next</span>
            <ArrowUp style={{ width: '16px', height: '16px', transform: 'rotate(90deg)' }} />
          </button>
        </div>
        
        {/* Mobile page info */}
        {viewportWidth <= 640 && (
          <div style={{
            marginTop: 'var(--spacing-base)',
            fontSize: 'var(--font-xs)',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            Page {brandCurrentPage} of {totalPages}
          </div>
        )}
      </div>
    );
  };

  // Loading component
  const LoadingSpinner = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
      <Loader2 style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite' }} />
      <span style={{ marginLeft: '8px' }}>Loading...</span>
    </div>
  );

  // Error component
  const ErrorMessage = ({ message, onRetry }) => (
    <div style={{ 
      backgroundColor: '#fee2e2', 
      border: '1px solid #fecaca', 
      borderRadius: '8px', 
      padding: '16px', 
      margin: '16px 0',
      textAlign: 'center'
    }}>
      <p style={{ color: '#b91c1c', marginBottom: '8px' }}>{message}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          style={{
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );

  // Check if current filters are different from default
  const hasCustomFilters = () => {
    const defaultFilters = {
      status: 'all',
      riskLevel: 'all',
      category: 'all',
      harmfulIngredients: 'all'
    };
    return JSON.stringify(filters) !== JSON.stringify(defaultFilters);
  };

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.riskLevel !== 'all') count++;
    if (filters.category !== 'all') count++;
    if (filters.harmfulIngredients !== 'all') count++;
    return count;
  };

  // Filter component
  const FilterComponent = () => {
    if (!showFilters) return null;

    return (
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>Filter Products</h4>
            {hasCustomFilters() && (
              <span style={{
                backgroundColor: '#f3f4f6',
                color: '#374151',
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid #d1d5db'
              }}>
                ✓ Preferences Saved
              </span>
            )}
          </div>
          <button 
            onClick={() => setShowFilters(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {/* Status Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Status
            </label>
            <select 
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="all">All Status</option>
              <option value="approved">Approved Only</option>
              <option value="cancelled">Cancelled Only</option>
            </select>
          </div>

          {/* Risk Level Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Risk Level
            </label>
            <select 
              value={filters.riskLevel}
              onChange={(e) => setFilters(prev => ({ ...prev, riskLevel: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Category
            </label>
            <select 
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="all">All Categories</option>
              {getUniqueCategories().map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Harmful Ingredients Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Harmful Ingredients
            </label>
            <select 
              value={filters.harmfulIngredients}
              onChange={(e) => setFilters(prev => ({ ...prev, harmfulIngredients: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="all">All Products</option>
              <option value="exclude">Exclude Harmful Ingredients</option>
              <option value="only">Only Products with Harmful Ingredients</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: hasCustomFilters() ? '12px' : '0' }}>
            <button 
              onClick={() => {
                setCurrentPage(1);
                handleSearch();
              }}
              style={{
                backgroundColor: '#9333ea',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Apply Filters
            </button>
            <button 
              onClick={() => {
                setFilters({
                  status: 'all',
                  riskLevel: 'all',
                  category: 'all',
                  harmfulIngredients: 'all'
                });
                setSearchResults([]);
                setCurrentPage(1);
              }}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear Filters
            </button>
          </div>
          
          {hasCustomFilters() && (
            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', color: '#92400e', fontWeight: '500' }}>
                    🔖 Filter preferences are saved
                  </p>
                  <p style={{ margin: 0, color: '#92400e', fontSize: '13px' }}>
                    Your filter settings will be remembered for future sessions
                  </p>
                </div>
                <button 
                  onClick={() => {
                    // Clear localStorage and reset to defaults
                    try {
                      localStorage.removeItem('cosmeticGuard_filterPreferences');
                    } catch (error) {
                      // Failed to clear filter preferences
                    }
                    setFilters({
                      status: 'all',
                      riskLevel: 'all',
                      category: 'all',
                      harmfulIngredients: 'all'
                    });
                    setSearchResults([]);
                    setCurrentPage(1);
                  }}
                  style={{
                    backgroundColor: '#d97706',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Reset Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Pagination Component with responsive design
  const PaginationComponent = () => {
    const totalPages = getTotalPages();
    const actualItemsPerPage = getCurrentItemsPerPage();
    const startIndex = (currentPage - 1) * actualItemsPerPage;
    const endIndex = Math.min(startIndex + actualItemsPerPage, searchResults.length);
    
    if (totalPages <= 1) return null;
    
    return (
      <div className="pagination-container">
        {/* Pagination info with responsive text */}
        <div className="pagination-info">
          <span>
            Showing <strong>{startIndex + 1}-{endIndex}</strong> of <strong>{searchResults.length}</strong> results
          </span>
          
        </div>

        {/* Pagination controls */}
        <div className="pagination-controls">
          {/* Previous Button */}
          <button
            className="pagination-button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <ArrowUp style={{ width: '16px', height: '16px', transform: 'rotate(-90deg)' }} />
            <span style={{ display: viewportWidth > 640 ? 'inline' : 'none' }}>Previous</span>
          </button>

          {/* Page Numbers */}
          {getPageNumbers().map((pageNum, idx) => (
            <button
              key={idx}
              className={`pagination-button ${pageNum === currentPage ? 'active' : ''}`}
              onClick={() => typeof pageNum === 'number' ? handlePageChange(pageNum) : null}
              disabled={pageNum === '...'}
              aria-label={typeof pageNum === 'number' ? `Go to page ${pageNum}` : 'More pages'}
            >
              {pageNum === '...' ? (
                '...'
              ) : (
                pageNum
              )}
            </button>
          ))}

          {/* Next Button */}
          <button
            className="pagination-button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            <span style={{ display: viewportWidth > 640 ? 'inline' : 'none' }}>Next</span>
            <ArrowUp style={{ width: '16px', height: '16px', transform: 'rotate(90deg)' }} />
          </button>
        </div>
        
        {/* Mobile page info */}
        {viewportWidth <= 640 && (
          <div style={{
            marginTop: 'var(--spacing-base)',
            fontSize: 'var(--font-xs)',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            Page {currentPage} of {totalPages}
          </div>
        )}
      </div>
    );
  };

  // Score Explanation Modal
  const ScoreExplanationModal = () => {
    if (!showScoreExplanation) return null;

    // Calculate score breakdown using real database data
    const calculateScoreBreakdown = async (product) => {
      if (!product) {
        return null;
      }
      
      // Try to get actual breakdown data from Result table
      try {
        const productBrand = product.brand || product.company;
        const breakdown = await cosmetics.getScoreBreakdownWithFallback(productBrand);
        
        if (breakdown) {
          
          // Get the bonuses/penalties value from database
          const bonusPenaltyValue = breakdown.bonuses_penalties || 0;
          
          // Use the database values as the authoritative source with proper validation
          const result = {
            finalScore: Math.round((breakdown.reliability_score || 0) * 10) / 10,
            baseScore: Math.round((breakdown.base_score || 0) * 10) / 10,
            components: [
              {
                name: "Cancellation History",
                weight: 40,
                rawScore: Math.round((breakdown.cancellation_score || 0) * 10) / 10,
                weightedScore: Math.round(((breakdown.cancellation_score || 0) * 0.4) * 10) / 10,
                description: `Brand cancellation performance`,
                details: `Score based on historical cancellation patterns`,
                isGood: (breakdown.cancellation_score || 0) >= 70
              },
              {
                name: "Category Portfolio",
                weight: 25,
                rawScore: Math.round((breakdown.category_score || 0) * 10) / 10,
                weightedScore: Math.round(((breakdown.category_score || 0) * 0.25) * 10) / 10,
                description: `Product category diversity`,
                details: `Points for operating across multiple categories`,
                isGood: (breakdown.category_score || 0) >= 50
              },
              {
                name: "Business Stability",
                weight: 20,
                rawScore: Math.round((breakdown.stability_score || 0) * 10) / 10,
                weightedScore: Math.round(((breakdown.stability_score || 0) * 0.2) * 10) / 10,
                description: `Operational consistency`,
                details: `Based on product approval rates and business maturity`,
                isGood: (breakdown.stability_score || 0) >= 80
              },
              {
                name: "Market Presence",
                weight: 15,
                rawScore: Math.round((breakdown.presence_score || 0) * 10) / 10,
                weightedScore: Math.round(((breakdown.presence_score || 0) * 0.15) * 10) / 10,
                description: `Market footprint and scale`,
                details: `Recognition for established market presence`,
                isGood: (breakdown.presence_score || 0) >= 60
              }
            ],
            bonuses: [],
            penalties: [],
            bonusesAndPenalties: Math.round((bonusPenaltyValue || 0) * 10) / 10,
            brandAge: breakdown.brand_age_years || 0,
            hasRecentProducts: breakdown.has_recent_products || false,
            hasOldProducts: breakdown.has_old_products || false,
            explanation: `Score calculated using advanced analytics on ${productBrand}'s complete product portfolio and regulatory history. Database contains pre-computed values using the complete algorithm.`
          };

          // Calculate and display actual bonuses/penalties that add up to the database value
          
          if (bonusPenaltyValue !== 0) {
            // Break down the bonuses_penalties value based on available data
            let remainingPoints = Math.round(bonusPenaltyValue * 10) / 10;
            
            // Recent Product Activity bonus
            if (breakdown.has_recent_products && remainingPoints > 0) {
              const recentBonus = Math.min(3, Math.round(remainingPoints * 10) / 10);
              result.bonuses.push({
                name: "Recent Product Activity",
                points: recentBonus,
                description: "Active in launching new products recently"
              });
              remainingPoints = Math.round((remainingPoints - recentBonus) * 10) / 10;
            }
            
            // Established Brand bonus
            if ((breakdown.brand_age_years || 0) >= 5 && remainingPoints > 0) {
              const ageBonus = Math.min(3, Math.round(remainingPoints * 10) / 10);
              result.bonuses.push({
                name: "Established Brand",
                points: ageBonus,
                description: `${(breakdown.brand_age_years || 0).toFixed(1)} years of market experience`
              });
              remainingPoints = Math.round((remainingPoints - ageBonus) * 10) / 10;
            }
            
            // Additional bonuses (if there are remaining positive points)
            if (remainingPoints > 0.1) { // Use 0.1 instead of 0 to account for floating point precision
              result.bonuses.push({
                name: "Additional Performance Bonuses",
                points: Math.round(remainingPoints * 10) / 10,
                description: "Extra points for strong performance indicators"
              });
            }
            
            // Handle penalties (negative bonuses_penalties)
            if (bonusPenaltyValue < 0) {
              result.penalties.push({
                name: "Risk Adjustments",
                points: Math.round(bonusPenaltyValue * 10) / 10, // This will be negative
                description: "Adjustments based on risk factors and compliance issues"
              });
            }
          }

          return result;
        } else {
          // Fallback to calculated breakdown if no database data
          return createFallbackBreakdown(product);
        }
      } catch (error) {
        return createFallbackBreakdown(product);
      }
    };

    const createFallbackBreakdown = (product) => {
      const fallbackScore = Math.round((product.riskScore || product.reliability_score || 75) * 10) / 10;
      
      return {
        finalScore: fallbackScore,
        baseScore: fallbackScore,
        components: [
          {
            name: "Product Reliability Score",
            weight: 100,
            rawScore: fallbackScore,
            weightedScore: fallbackScore,
            description: `Based on available product data`,
            details: `Individual product assessment: ${fallbackScore}/100`,
            isGood: fallbackScore >= 70
          }
        ],
        bonuses: [],
        penalties: [],
        bonusesAndPenalties: 0,
        explanation: `Detailed brand analysis not available. Showing product-level reliability score of ${fallbackScore}/100.`
      };
    };

    // Use React effect to load breakdown data
    const [breakdown, setBreakdown] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      const loadBreakdown = async () => {
        if (scoreCalculationData) {
          setLoading(true);
          const result = await calculateScoreBreakdown(scoreCalculationData);
          setBreakdown(result);
          setLoading(false);
        }
      };
      
      loadBreakdown();
    }, [scoreCalculationData]);

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '700px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>How This Score Was Calculated</h3>
            <button 
              onClick={() => setShowScoreExplanation(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X style={{ width: '24px', height: '24px' }} />
            </button>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
              <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading detailed score breakdown...</p>
            </div>
          )}

          {!loading && breakdown && breakdown.components && breakdown.components.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                textAlign: 'center',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '2px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e40af' }}>
                  {breakdown.finalScore}/100
                </div>
                <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                  Final Reliability Score
                </div>
                {breakdown.brandAge && (
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Brand Age: {breakdown.brandAge.toFixed(1)} years
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>
                  Score Breakdown:
                </h4>

                {breakdown.components.map((component, index) => (
                  <div key={index} style={{
                    padding: '12px',
                    marginBottom: '12px',
                    backgroundColor: component.isGood ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${component.isGood ? '#bbf7d0' : '#fecaca'}`,
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontWeight: '600', 
                          color: component.isGood ? '#166534' : '#991b1b'
                        }}>
                          {component.name}
                        </span>
                        <span style={{
                          fontSize: '12px',
                          backgroundColor: '#e2e8f0',
                          color: '#475569',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {component.weight}% weight
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ 
                          fontWeight: '700', 
                          fontSize: '16px',
                          color: component.isGood ? '#166534' : '#991b1b'
                        }}>
                          +{component.weightedScore} pts
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          ({component.rawScore}/100 × {component.weight}%)
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
                      {component.description}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {component.details}
                    </div>
                  </div>
                ))}

                <div style={{
                  padding: '12px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '1px solid #cbd5e1'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: '#374151' }}>Base Score</span>
                    <span style={{ fontWeight: '700', fontSize: '16px', color: '#374151' }}>
                      {breakdown.baseScore} pts
                    </span>
                  </div>
                </div>

                {/* Bonuses */}
                {breakdown.bonuses.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#166534' }}>
                      Bonuses Applied:
                    </h5>
                    {breakdown.bonuses.map((bonus, index) => (
                      <div key={index} style={{
                        padding: '8px 12px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontWeight: '500', color: '#166534', fontSize: '14px' }}>
                            {bonus.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#16803d' }}>
                            {bonus.description}
                          </div>
                        </div>
                        <span style={{ fontWeight: '700', color: '#166534' }}>
                          +{bonus.points}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Penalties */}
                {breakdown.penalties.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#dc2626' }}>
                      Penalties Applied:
                    </h5>
                    {breakdown.penalties.map((penalty, index) => (
                      <div key={index} style={{
                        padding: '8px 12px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontWeight: '500', color: '#dc2626', fontSize: '14px' }}>
                            {penalty.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#dc2626' }}>
                            {penalty.description}
                          </div>
                        </div>
                        <span style={{ fontWeight: '700', color: '#dc2626' }}>
                          {penalty.points}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Final Calculation */}
                <div style={{
                  padding: '16px',
                  backgroundColor: '#1e40af',
                  color: 'white',
                  borderRadius: '8px',
                  marginTop: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '600' }}>Final Calculation:</span>
                  </div>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                    Base Score ({breakdown.baseScore}) + Bonuses/Penalties ({breakdown.bonusesAndPenalties > 0 ? '+' : ''}{breakdown.bonusesAndPenalties})
                  </div>
                  <div style={{ 
                    fontSize: '20px', 
                    fontWeight: '700', 
                    textAlign: 'center',
                    padding: '8px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '4px'
                  }}>
                    = {breakdown.finalScore}/100
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && breakdown && breakdown.explanation && (
            <div style={{
              padding: '16px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#1e40af', margin: 0, fontSize: '14px' }}>
                {breakdown.explanation}
              </p>
            </div>
          )}

          {!loading && !breakdown && (
            <div>
              <p style={{ fontSize: '14px', color: '#374151', marginBottom: '16px', lineHeight: '1.5' }}>
                Our Reliability Score is a comprehensive metric (0-100) that evaluates brand trustworthiness across multiple dimensions to help you make informed purchasing decisions.
              </p>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#111827' }}>Key Components:</h4>
                
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#166534' }}>• Cancellation History (40%)</span>
                  <p style={{ fontSize: '14px', color: '#6b7280', marginLeft: '16px', marginTop: '4px' }}>
                    Brands with lower cancellation rates score higher, indicating reliable regulatory compliance
                  </p>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#166534' }}>• Business Maturity (25%)</span>
                  <p style={{ fontSize: '14px', color: '#6b7280', marginLeft: '16px', marginTop: '4px' }}>
                    Brands offering diverse product categories demonstrate operational stability and market experience
                  </p>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#166534' }}>• Product Stability (20%)</span>
                  <p style={{ fontSize: '14px', color: '#6b7280', marginLeft: '16px', marginTop: '4px' }}>
                    Higher percentage of approved products suggests better quality control and compliance
                  </p>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#166534' }}>• Market Presence (15%)</span>
                  <p style={{ fontSize: '14px', color: '#6b7280', marginLeft: '16px', marginTop: '4px' }}>
                    Established brands with substantial product portfolios receive recognition for their proven track record
                  </p>
                </div>
              </div>
            </div>
          )}

          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f8fafc', 
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '16px'
          }}>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
              The score combines these weighted components with bonus and penalty adjustments to create a single, easy-to-understand reliability rating. Higher scores indicate brands with better regulatory compliance, diverse offerings, stable operations, and proven market presence.
            </p>
          </div>

          <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', margin: 0, lineHeight: '1.4' }}>
            *This scoring system uses advanced analytics and machine learning to analyze brand performance patterns, regulatory history, and market behavior to help you identify trustworthy cosmetic brands.*
          </p>
        </div>
      </div>
    );
  };
  const IngredientModal = () => {
    if (!showIngredientModal || !selectedIngredient) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Ingredient Details</h3>
            <button 
              onClick={() => setShowIngredientModal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X style={{ width: '24px', height: '24px' }} />
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{selectedIngredient.name}</h4>
              <span style={{
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: '500',
                backgroundColor: selectedIngredient.risk === 'high' ? '#fee2e2' : 
                                selectedIngredient.risk === 'medium' ? '#fef3c7' : '#dcfce7',
                color: selectedIngredient.risk === 'high' ? '#991b1b' :
                       selectedIngredient.risk === 'medium' ? '#92400e' : '#166534'
              }}>
                {selectedIngredient.risk === 'high' ? 'High Risk' : 
                 selectedIngredient.risk === 'medium' ? 'Medium Risk' : 'Low Risk'}
              </span>
            </div>

            {selectedIngredient.commonName && (
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                <strong>Also known as:</strong> {selectedIngredient.commonName}
              </p>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <h5 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#dc2626' }}>Health Effects</h5>
            <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>{selectedIngredient.effects}</p>
          </div>

          {selectedIngredient.usage && (
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Common Usage</h5>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>{selectedIngredient.usage}</p>
            </div>
          )}

          {selectedIngredient.shortRisk && (
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#dc2626' }}>Short-term Risks</h5>
              <p style={{ fontSize: '14px', color: '#dc2626' }}>{selectedIngredient.shortRisk}</p>
            </div>
          )}

          {selectedIngredient.longRisk && (
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#dc2626' }}>Long-term Risks</h5>
              <p style={{ fontSize: '14px', color: '#dc2626' }}>{selectedIngredient.longRisk}</p>
            </div>
          )}

          {selectedIngredient.alternative && (
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#059669' }}>Safer Alternatives</h5>
              <p style={{ fontSize: '14px', color: '#059669' }}>{selectedIngredient.alternative}</p>
            </div>
          )}

          {selectedIngredient.simpleExplanation && (
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Simple Explanation</h5>
              <p style={{ fontSize: '14px', color: '#4b5563', fontStyle: 'italic' }}>{selectedIngredient.simpleExplanation}</p>
            </div>
          )}

          <div style={{ 
            padding: '12px', 
            backgroundColor: '#fef2f2', 
            borderRadius: '8px',
            border: '1px solid #fecaca'
          }}>
            <p style={{ fontSize: '12px', color: '#b91c1c', margin: 0, display: 'flex', alignItems: 'center' }}>
              <AlertTriangle style={{ width: '12px', height: '12px', marginRight: '4px' }} />
              {selectedIngredient.banStatus || 'Banned by MOH Malaysia and multiple international health authorities'}
              {selectedIngredient.bannedYear && ` (Since ${selectedIngredient.bannedYear})`}
            </p>
          </div>
        </div>
      </div>
    );
  };
  
  // Determine which product is safer based on reliability score (higher = safer)
  const determineSaferProduct = (originalProduct, alternativeProduct) => {
    const originalScore = originalProduct?.riskScore || 0;
    const alternativeScore = alternativeProduct?.riskScore || 0;
    
    if (originalScore > alternativeScore) {
      return { safer: 'original', riskier: 'alternative' };
    } else if (alternativeScore > originalScore) {
      return { safer: 'alternative', riskier: 'original' };
    } else {
      return { safer: null, riskier: null }; // Equal scores
    }
  };

  const ComparisonModal = () => {
    if (!showComparisonModal || !comparisonData) return null;

    // Determine which product is safer
    const safetyResult = determineSaferProduct(comparisonData.original, comparisonData.alternative);

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Product Comparison</h3>
            <button 
              onClick={() => setShowComparisonModal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X style={{ width: '24px', height: '24px' }} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Original Product */}
            <div className="comparison-product-container">
              <h4 style={{ color: '#dc2626', marginBottom: '12px' }}>Current Product</h4>
              <div 
                className={`${safetyResult.safer === 'original' ? 'safer-product' : safetyResult.riskier === 'original' ? 'riskier-product' : ''}`}
                style={{ 
                  padding: '16px', 
                  border: '2px solid #fecaca', 
                  borderRadius: '8px', 
                  backgroundColor: '#fef2f2',
                  position: 'relative'
                }}
              >
                {safetyResult.safer === 'original' && (
                  <div className="safety-badge recommended-badge">
                    <CheckCircle style={{ width: '14px', height: '14px' }} />
                    Recommended
                  </div>
                )}
                {safetyResult.riskier === 'original' && (
                  <div className="safety-badge warning-badge">
                    <AlertTriangle style={{ width: '14px', height: '14px' }} />
                    Higher Risk
                  </div>
                )}
                <h5 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>{comparisonData.original.name}</h5>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>{comparisonData.original.brand}</p>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Risk Score: </span>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: safetyResult.safer === 'original' ? '#059669' : '#dc2626' }}>
                    {comparisonData.original.riskScore}/100
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Status: </span>
                  <span style={{ color: comparisonData.original.status === 'approved' ? '#059669' : '#dc2626' }}>
                    {comparisonData.original.status === 'approved' ? 'Approved' : 'Cancelled'}
                  </span>
                </div>
                {comparisonData.original.harmfulIngredients && comparisonData.original.harmfulIngredients.length > 0 && (
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#dc2626' }}>Harmful Ingredients: </span>
                    <div style={{ marginTop: '4px' }}>
                      {comparisonData.original.harmfulIngredients.map((ing, idx) => (
                        <span key={idx} style={{ 
                          display: 'inline-block', 
                          backgroundColor: '#fecaca', 
                          color: '#b91c1c',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          marginRight: '4px',
                          marginBottom: '4px'
                        }}>
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Alternative Product */}
            <div className="comparison-product-container">
              <h4 style={{ color: '#059669', marginBottom: '12px' }}>Alternative Product</h4>
              <div 
                className={`${safetyResult.safer === 'alternative' ? 'safer-product' : safetyResult.riskier === 'alternative' ? 'riskier-product' : ''}`}
                style={{ 
                  padding: '16px', 
                  border: '2px solid #bbf7d0', 
                  borderRadius: '8px', 
                  backgroundColor: '#f0fdf4',
                  position: 'relative'
                }}
              >
                {safetyResult.safer === 'alternative' && (
                  <div className="safety-badge recommended-badge">
                    <CheckCircle style={{ width: '14px', height: '14px' }} />
                    Recommended
                  </div>
                )}
                {safetyResult.riskier === 'alternative' && (
                  <div className="safety-badge warning-badge">
                    <AlertTriangle style={{ width: '14px', height: '14px' }} />
                    Higher Risk
                  </div>
                )}
                <h5 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>{comparisonData.alternative.name}</h5>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>{comparisonData.alternative.brand}</p>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Risk Score: </span>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: safetyResult.safer === 'alternative' ? '#059669' : '#dc2626' }}>
                    {comparisonData.alternative.riskScore}/100
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Status: </span>
                  <span style={{ color: comparisonData.alternative.status === 'approved' ? '#059669' : '#dc2626' }}>
                    {comparisonData.alternative.status === 'approved' ? 'Approved' : 'Cancelled'}
                  </span>
                </div>
                {comparisonData.alternative.harmfulIngredients && comparisonData.alternative.harmfulIngredients.length > 0 ? (
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#dc2626' }}>Harmful Ingredients: </span>
                    <div style={{ marginTop: '4px' }}>
                      {comparisonData.alternative.harmfulIngredients.map((ing, idx) => (
                        <span key={idx} style={{ 
                          display: 'inline-block', 
                          backgroundColor: '#fecaca', 
                          color: '#b91c1c',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          marginRight: '4px',
                          marginBottom: '4px'
                        }}>
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#059669', fontSize: '14px' }}>
                    ✅ No harmful ingredients detected
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ 
            marginTop: '20px', 
            padding: '12px', 
            backgroundColor: safetyResult.safer === 'alternative' ? '#eff6ff' : safetyResult.safer === 'original' ? '#f0fdf4' : '#f9fafb', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '14px', color: safetyResult.safer === 'alternative' ? '#1e40af' : safetyResult.safer === 'original' ? '#047857' : '#4b5563', margin: 0 }}>
              <strong>Recommendation:</strong> 
              {safetyResult.safer === 'alternative' && ' The alternative product has a better safety profile with lower risk.'}
              {safetyResult.safer === 'original' && ' The current product appears to be safer than the alternative.'}
              {safetyResult.safer === null && ' Both products have similar risk scores. Please review their details carefully.'}
            </p>
          </div>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button 
              onClick={() => {
                const productToSave = safetyResult.safer === 'original' ? comparisonData.original : comparisonData.alternative;
                saveAlternative(productToSave);
                setShowComparisonModal(false);
              }}
              style={{
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              <Bookmark style={{ width: '16px', height: '16px', marginRight: '6px', display: 'inline' }} />
              Save {safetyResult.safer === 'original' ? 'Current' : 'Alternative'} Product
            </button>
            <button 
              onClick={() => setShowComparisonModal(false)}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Status explanation modal (AC1.2.3)
  const StatusModal = () => {
    if (!showStatusModal || !statusModalData) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Product Status Information</h3>
            <button 
              onClick={() => setShowStatusModal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X style={{ width: '24px', height: '24px' }} />
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
              {statusModalData.product.name}
            </h4>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              Notification: {statusModalData.product.notificationNumber}
            </p>
          </div>

          <div style={{
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: statusModalData.status === 'approved' ? '#f0fdf4' : '#fef2f2',
            border: `2px solid ${statusModalData.status === 'approved' ? '#bbf7d0' : '#fecaca'}`,
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              {getStatusIcon(statusModalData.status)}
              <span style={{ 
                marginLeft: '8px', 
                fontWeight: '600',
                color: statusModalData.status === 'approved' ? '#166534' : '#991b1b'
              }}>
                {statusModalData.status === 'approved' ? 'APPROVED by MOH Malaysia' : 'CANCELLED by MOH Malaysia'}
              </span>
            </div>
            
            {statusModalData.status === 'approved' ? (
              <div>
                <p style={{ fontSize: '14px', color: '#166534', marginBottom: '8px' }}>
                  ✅ This product has been officially approved by the Ministry of Health Malaysia and is safe for use when used as directed.
                </p>
                <p style={{ fontSize: '12px', color: '#166534' }}>
                  The product meets Malaysian safety standards and regulatory requirements for cosmetic products.
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '14px', color: '#991b1b', marginBottom: '8px' }}>
                  ⚠️ This product has been cancelled by MOH Malaysia and should NOT be used.
                </p>
                <p style={{ fontSize: '12px', color: '#991b1b' }}>
                  The cancellation indicates safety concerns or regulatory violations that make the product unsuitable for use.
                </p>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <h5 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Risk Assessment Score</h5>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: statusModalData.riskScore <= 40 ? '#fef2f2' : 
                              statusModalData.riskScore <= 70 ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${statusModalData.riskScore <= 40 ? '#fecaca' : 
                                   statusModalData.riskScore <= 70 ? '#fed7aa' : '#bbf7d0'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{getRiskText(statusModalData.riskScore)}</span>
                <span style={{ fontSize: '18px', fontWeight: '700' }}>
                  {statusModalData.riskScore}/100
                </span>
              </div>
              <p style={{ fontSize: '12px', marginTop: '4px', color: '#6b7280' }}>
                {statusModalData.riskScore <= 40 ? 'High risk products may contain harmful substances or have safety concerns.' :
                 statusModalData.riskScore <= 70 ? 'Medium risk products require caution and careful use.' :
                 'Low risk products are generally considered safe when used as directed.'}
              </p>
            </div>
          </div>

          {statusModalData.harmfulIngredients && statusModalData.harmfulIngredients.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#dc2626' }}>
                Harmful Ingredients Detected
              </h5>
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#fef2f2', 
                borderRadius: '8px',
                border: '1px solid #fecaca'
              }}>
                {statusModalData.harmfulIngredients.map((ingredient, idx) => {
                  const ingredientInfo = ingredients.find(ing => 
                    (ing.substance_detected || ing.substance || '').toString().toUpperCase() === ingredient.toString().toUpperCase()
                  );
                  return (
                    <div key={idx} style={{ marginBottom: '8px' }}>
                      <span style={{ fontWeight: '500', color: '#dc2626' }}>{ingredient.toString().toUpperCase()}</span>
                      {ingredientInfo && (
                        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                          {ingredientInfo.health_effect}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ 
            padding: '12px', 
            backgroundColor: '#eff6ff', 
            borderRadius: '8px', 
            border: '1px solid #bfdbfe' 
          }}>
            <p style={{ fontSize: '12px', color: '#1e40af', margin: 0 }}>
              💡 <strong>Advice:</strong> Always consult with dermatologists or healthcare professionals if you have concerns about cosmetic products. For medical advice, please seek professional consultation.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // No results modal (AC1.1.4)
  const NoResultsModal = () => {
    if (!showNoResultsModal) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <AlertCircle style={{ width: '48px', height: '48px', color: '#d97706', margin: '0 auto 12px' }} />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Product Not Found</h3>
          </div>

          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            We couldn't find "{searchQuery}" in our database. This might be a new product or the search terms might need adjustment.
          </p>

          <div style={{
            padding: '16px',
            backgroundColor: '#eff6ff',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
              <Mail style={{ width: '20px', height: '20px', color: '#2563eb', marginRight: '8px' }} />
              <span style={{ fontWeight: '500', color: '#2563eb' }}>Help Us Improve</span>
            </div>
            <p style={{ fontSize: '14px', color: '#1e40af', marginBottom: '12px' }}>
              Send us the product details for review and we'll add it to our database.
            </p>
            <a 
              href="mailto:dummy@monash.edu?subject=Product Review Request&body=Product Name: [Enter product name]%0ABrand: [Enter brand name]%0ANotification Number (if available): [Enter NOT number]%0AAdditional Information: [Any other details]"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <Mail style={{ width: '16px', height: '16px', marginRight: '6px' }} />
              Send to dummy@monash.edu
              <ExternalLink style={{ width: '12px', height: '12px', marginLeft: '6px' }} />
            </a>
          </div>

          <button 
            onClick={() => setShowNoResultsModal(false)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  const ProductCard = ({ product, isAlternative = false, showComparisonButton = false, originalProduct = null }) => {
    const formattedProduct = formatProduct(product);
    const isSaved = savedAlternatives.some(alt => alt.notif_no === product.notif_no);
    
    // Handle product card click - if it's an alternative, show comparison instead of selecting
    const handleProductCardClick = () => {
      if (isAlternative && originalProduct) {
        // originalProduct is already formatted when it's selectedProduct
        showComparison(originalProduct, product);
      } else {
        handleProductSelect(product);
      }
    };
    
    return (
      <div className="product-card" onClick={handleProductCardClick}>
        {/* Alternative badge */}
        {isAlternative && (
          <div className="alternative-badge">
            ✅ {isAlternative && originalProduct ? 'Click to Compare' : 'Safe Alternative'}
          </div>
        )}
        
        {/* Header section with flexible layout */}
        <div className="product-header">
          <div className="product-info">
            <h3 className="product-name" title={formattedProduct.name}>
              {formattedProduct.name}
            </h3>
            <p className="product-brand" title={formattedProduct.brand}>
              {formattedProduct.brand}
            </p>
            <p className="product-not">
              NOT: {formattedProduct.notificationNumber}
            </p>
          </div>
          
          <div className="product-actions">
            {/* Status indicator */}
            <div 
              className={`product-status ${formattedProduct.status}`}
              onClick={(e) => {
                e.stopPropagation();
                showStatusExplanation(product);
              }}
              title="Click for more information"
            >
              {getStatusIcon(formattedProduct.status)}
              <span>{formattedProduct.status === 'approved' ? 'Approved' : 'Cancelled'}</span>
              <Info style={{ width: '12px', height: '12px', opacity: 0.7 }} />
            </div>
            
            {/* Save button */}
            <button
              className={`save-button ${isSaved ? 'saved' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isSaved) {
                  removeSavedAlternative(product.notif_no);
                } else {
                  saveAlternative(product);
                }
              }}
              title={isSaved ? 'Remove from saved' : 'Save alternative'}
            >
              {isSaved ? (
                <BookmarkCheck style={{ width: '12px', height: '12px' }} />
              ) : (
                <Bookmark style={{ width: '12px', height: '12px' }} />
              )}
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>
        
        {/* Risk assessment section */}
        <div className={`risk-assessment ${getRiskLevel(formattedProduct.riskScore)}`}>
          <div className="risk-header">
            <span className="risk-label">Risk Assessment</span>
            <span className="risk-score">{formattedProduct.riskScore}/100</span>
          </div>
          
          <div className="risk-level">
            {getRiskText(formattedProduct.riskScore)}
          </div>
          
          <button
            className="score-calculation-link"
            onClick={(e) => {
              e.stopPropagation();
              setScoreCalculationData(formattedProduct);
              setShowScoreExplanation(true);
            }}
            title="View detailed score breakdown"
          >
            How this score was calculated
          </button>
        </div>

        {/* Harmful ingredients section - only for cancelled products */}
        {formattedProduct.status === 'cancelled' && 
         formattedProduct.harmfulIngredients && 
         formattedProduct.harmfulIngredients.length > 0 && (
          <div className="harmful-ingredients">
            <div className="harmful-header">
              <AlertTriangle style={{ width: '16px', height: '16px' }} />
              <span className="harmful-title">Harmful Ingredients Found</span>
            </div>
            <div className="ingredients-list">
              {formattedProduct.harmfulIngredients.map((ing, idx) => (
                <span 
                  key={idx} 
                  className="ingredient-tag"
                  onClick={(e) => {
                    e.stopPropagation();
                    showIngredientDetails(ing);
                  }}
                  title={`Click for details about ${ing.toString().toUpperCase()}`}
                >
                  {ing.toString().toUpperCase()}
                  <Info style={{ width: '10px', height: '10px', marginLeft: '4px' }} />
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Comparison button for alternatives */}
        {showComparisonButton && originalProduct && (
          <div style={{ marginTop: 'var(--spacing-base)' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                showComparison(originalProduct, product);
              }}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: 'var(--spacing-sm) var(--spacing-base)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 'var(--font-xs)',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                width: '100%',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              <ArrowLeftRight style={{ width: '14px', height: '14px' }} />
              Compare
            </button>
          </div>
        )}

        {/* Product meta - always at bottom */}
        <div className="product-meta">
          <span title={`Category: ${formattedProduct.category}`}>
            Category: {formattedProduct.category}
          </span>
          <span title={`Last updated: ${formattedProduct.lastUpdated}`}>
            Updated: {formattedProduct.lastUpdated}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-brand" onClick={resetToHomepage} style={{ cursor: 'pointer' }}>
            <Shield style={{ width: '32px', height: '32px', color: '#9333ea' }} />
            <div>
              <h1 className="header-title">CosmeticGuard</h1>
              <p className="header-subtitle">Your Cosmetic Safety Companion</p>
            </div>
          </div>
          <nav className="nav">
            <button
              onClick={() => setActiveTab('search')}
              className={`nav-button ${activeTab === 'search' ? 'active' : ''}`}
            >
              Product Search
            </button>
            <button
              onClick={() => setActiveTab('ingredients')}
              className={`nav-button ${activeTab === 'ingredients' ? 'active' : ''}`}
            >
              Ingredients
            </button>
            <button
              onClick={() => setActiveTab('brands')}
              className={`nav-button ${activeTab === 'brands' ? 'active' : ''}`}
            >
              Brand Safety
            </button>
            {savedAlternatives.length > 0 && (
              <button
                onClick={() => setShowSavedAlternatives(!showSavedAlternatives)}
                className={`nav-button ${showSavedAlternatives ? 'active' : ''}`}
                style={{ position: 'relative' }}
              >
                Saved ({savedAlternatives.length})
                {savedAlternatives.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {savedAlternatives.length}
                  </span>
                )}
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section - Fixed Stats */}
      {activeTab === 'search' && !searchResults.length && !selectedProduct && !showSavedAlternatives && (
        <div className="hero">
          <div className="hero-content">
            <h2 className="hero-title">Check Your Cosmetics Safety</h2>
            <p className="hero-subtitle">
              Protect your skin by verifying product safety before you buy
            </p>
            <div className="hero-stats">
              <div className="hero-stat">
                <div className="hero-stat-number">
                  200K+
                </div>
                <div className="hero-stat-label">Products Monitored</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-number">
                  {loading ? '...' : formatNumber(cancelledProducts.length)}
                </div>
                <div className="hero-stat-label">Cancelled Products</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-number">24/7</div>
                <div className="hero-stat-label">Real-time Updates</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug Info */}
      {(loading || error) && (
        <div style={{ padding: '0 24px' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
            {/* Error Display */}
            {error && <ErrorMessage message={error} onRetry={loadInitialData} />}
            
            {/* Debug console note */}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        {/* Search Tab */}
        {activeTab === 'search' && (
          <div>
            {/* Search Interface */}
            {!selectedProduct && !showSavedAlternatives && (
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                {/* Search Type Dropdown */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ position: 'relative', display: 'inline-block', width: '200px' }} className="search-type-dropdown">
                    <button
                      onClick={() => setShowSearchTypeDropdown(!showSearchTypeDropdown)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      {getSearchTypeLabel()}
                      <span style={{ transform: showSearchTypeDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                    </button>
                    
                    {showSearchTypeDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        marginTop: '4px',
                        zIndex: 10,
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }}>
                        {[
                          { key: 'all', label: 'Search All Fields' },
                          { key: 'company', label: 'Search by Company' },
                          { key: 'product', label: 'Search by Product Name' },
                          { key: 'notification', label: 'Search by Notification Number' }
                        ].map(option => (
                          <button
                            key={option.key}
                            onClick={() => {
                              setSearchType(option.key);
                              setShowSearchTypeDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: 'none',
                              backgroundColor: searchType === option.key ? '#f3f4f6' : 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              borderBottom: '1px solid #f3f4f6'
                            }}
                            onMouseEnter={(e) => {
                              if (searchType !== option.key) {
                                e.target.style.backgroundColor = '#f9fafb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (searchType !== option.key) {
                                e.target.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Main Search Bar with Description */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: '#374151', 
                    marginBottom: '8px' 
                  }}>
                    Search All Fields (English/Bahasa Malaysia)
                  </label>
                  <div style={{ position: 'relative' }} className="search-input-container">
                    <Search style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '20px',
                      height: '20px',
                      color: '#6b7280'
                    }} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchInputChange(e.target.value)}
                      placeholder={getSearchPlaceholder()}
                      style={{
                        width: '100%',
                        padding: '16px 16px 16px 48px',
                        border: '2px solid #d1d5db',
                        borderRadius: '12px',
                        fontSize: '16px',
                        outline: 'none',
                        transition: 'border-color 0.2s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#9333ea'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch();
                        }
                      }}
                    />
                    
                    {/* Search Suggestions */}
                    {showSuggestions && searchSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        marginTop: '4px',
                        zIndex: 10,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}>
                        {searchSuggestions.map((suggestion, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSuggestionSelect(suggestion)}
                            style={{
                              padding: '12px 16px',
                              borderBottom: idx < searchSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                          >
                            <div style={{ fontWeight: '500' }}>{suggestion.product}</div>
                            <div style={{ color: '#6b7280', fontSize: '12px' }}>{suggestion.company}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Search Button, Filters, and History */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      onClick={() => {
                        setCurrentPage(1);
                        handleSearch();
                      }}
                      disabled={loading}
                      style={{
                        backgroundColor: loading ? '#9ca3af' : '#9333ea',
                        color: 'white',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      {loading ? (
                        <>
                          <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search style={{ width: '16px', height: '16px' }} />
                          Search
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      style={{
                        backgroundColor: showFilters ? '#9333ea' : (getActiveFilterCount() > 0 ? '#f3f4f6' : 'white'),
                        color: showFilters ? 'white' : '#6b7280',
                        border: `1px solid ${getActiveFilterCount() > 0 ? '#9333ea' : '#d1d5db'}`,
                        padding: '12px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      <Filter style={{ width: '16px', height: '16px' }} />
                      Filters
                      {getActiveFilterCount() > 0 && (
                        <span style={{
                          backgroundColor: showFilters ? 'rgba(255, 255, 255, 0.2)' : '#9333ea',
                          color: showFilters ? 'white' : 'white',
                          fontSize: '12px',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          minWidth: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '600'
                        }}>
                          {getActiveFilterCount()}
                        </span>
                      )}
                    </button>
                  </div>
                  
                  {/* History Button */}
                  <button
                    onClick={() => setShowSearchHistory(!showSearchHistory)}
                    style={{
                      backgroundColor: showSearchHistory ? '#3b82f6' : 'white',
                      color: showSearchHistory ? 'white' : '#6b7280',
                      border: '1px solid #d1d5db',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    History
                    {searchHistory.length > 0 && (
                      <span style={{
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        fontSize: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {searchHistory.length}
                      </span>
                    )}
                  </button>
                </div>
                
                {/* Search History - displayed right below search bar */}
                {showSearchHistory && (
                  <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>
                          Search History
                        </h3>
                        <p style={{ color: '#6b7280', fontSize: '14px' }}>
                          Your recent searches and results
                        </p>
                      </div>
                      {searchHistory.length > 0 && (
                        <button
                          onClick={clearSearchHistory}
                          style={{
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Clear History
                        </button>
                      )}
                    </div>

                    {searchHistory.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px' }}>
                        <Search style={{ width: '40px', height: '40px', color: '#d1d5db', margin: '0 auto 12px' }} />
                        <h4 style={{ color: '#6b7280', marginBottom: '6px', fontSize: '16px' }}>No search history yet</h4>
                        <p style={{ color: '#9ca3af', fontSize: '14px' }}>Your search history will appear here as you search for products</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                        {searchHistory.map(item => (
                          <div
                            key={item.id}
                            onClick={() => repeatSearch(item)}
                            style={{
                              backgroundColor: '#f9fafb',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              padding: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#f3f4f6';
                              e.target.style.borderColor = '#9333ea';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#f9fafb';
                              e.target.style.borderColor = '#e5e7eb';
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <Search style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                                <span style={{ fontWeight: '500', fontSize: '14px' }}>{item.query}</span>
                                <span style={{
                                  backgroundColor: item.searchType === 'all' ? '#e5e7eb' : '#ddd6fe',
                                  color: item.searchType === 'all' ? '#374151' : '#5b21b6',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  fontSize: '10px',
                                  fontWeight: '500'
                                }}>
                                  {item.searchType === 'all' ? 'All Fields' : 
                                   item.searchType === 'company' ? 'Company' :
                                   item.searchType === 'product' ? 'Product' : 'Notification'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#6b7280' }}>
                                <span>{item.resultsCount} results found</span>
                                <span>{new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                            </div>
                            <div style={{ color: '#9333ea', fontSize: '12px', fontWeight: '500' }}>
                              Search Again →
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Filter Component */}
            <FilterComponent />

            {/* No results due to filters message */}
            {searchResults.length === 0 && searchQuery && !loading && !error && 
             (filters.status !== 'all' || filters.riskLevel !== 'all' || filters.category !== 'all' || filters.harmfulIngredients !== 'all') && 
             unfilteredResultsCount > 0 && (
              <div style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: '8px',
                padding: '16px',
                margin: '16px 0',
                textAlign: 'center'
              }}>
                <p style={{ color: '#92400e', marginBottom: '8px' }}>
                  Found {unfilteredResultsCount} product{unfilteredResultsCount !== 1 ? 's' : ''}, but none matched your current filters.
                </p>
                <p style={{ color: '#92400e', marginBottom: '12px', fontSize: '14px' }}>
                  Current filters: 
                  {filters.status !== 'all' && ` Status: ${filters.status}`}
                  {filters.riskLevel !== 'all' && ` | Risk: ${filters.riskLevel}`}
                  {filters.category !== 'all' && ` | Category: ${filters.category}`}
                  {filters.harmfulIngredients !== 'all' && ` | Ingredients: ${filters.harmfulIngredients}`}
                </p>
                <p style={{ color: '#92400e', marginBottom: '12px', fontSize: '14px' }}>
                  Try adjusting your filter settings or clearing all filters to see more results.
                </p>
                <button 
                  onClick={() => {
                    setFilters({
                      status: 'all',
                      riskLevel: 'all',
                      category: 'all',
                      harmfulIngredients: 'all'
                    });
                    setCurrentPage(1); // Reset pagination
                    setTimeout(() => handleSearch(), 100);
                  }}
                  style={{
                    backgroundColor: '#d97706',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Clear All Filters
                </button>
              </div>
            )}

            {/* Recent Approved Products Section - Only show when no search results and no selected product */}
            {!searchResults.length && !selectedProduct && !showSavedAlternatives && (
              <div style={{ marginBottom: '40px' }}>
                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>
                    Recently Approved Products
                  </h2>
                  <p style={{ color: '#6b7280' }}>
                    Latest products that have been approved by MOH Malaysia
                  </p>
                </div>
                
                {loading && (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Loader2 style={{ width: '32px', height: '32px', animation: 'spin 1s linear infinite', margin: '0 auto', color: '#9333ea' }} />
                    <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading recent products...</p>
                  </div>
                )}
                
                {!loading && recentApprovedProducts.length > 0 && (
                  <div className="products-grid">
                    {recentApprovedProducts.map(product => (
                      <ProductCard 
                        key={product.notif_no} 
                        product={product}
                      />
                    ))}
                  </div>
                )}
                
                {!loading && recentApprovedProducts.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    <AlertCircle style={{ width: '48px', height: '48px', color: '#6b7280', margin: '0 auto 16px' }} />
                    <h3 style={{ color: '#6b7280', marginBottom: '8px' }}>No recent products available</h3>
                    <p style={{ color: '#9ca3af' }}>Recent approved products will appear here when data is loaded</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}


        {/* Saved Alternatives View */}
        {showSavedAlternatives && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>
                Saved Alternative Products
              </h2>
              <p style={{ color: '#6b7280' }}>
                Your saved safe alternatives for future reference
              </p>
            </div>

            {savedAlternatives.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Bookmark style={{ width: '48px', height: '48px', color: '#d1d5db', margin: '0 auto 16px' }} />
                <h3 style={{ color: '#6b7280', marginBottom: '8px' }}>No saved alternatives yet</h3>
                <p style={{ color: '#9ca3af' }}>Save products you're interested in to access them quickly later</p>
              </div>
            ) : (
              <div className="products-grid">
                {savedAlternatives.map(product => (
                  <ProductCard key={product.notif_no} product={product} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ingredients Tab with Enhanced Information */}
        {activeTab === 'ingredients' && (
          <div>
            <div className="section-header">
              <h2 className="section-title">Harmful Ingredients Database</h2>
              <p className="section-subtitle">
                Learn about commonly banned substances in cosmetics and their health effects
              </p>
            </div>

            {/* Ingredient Search and Sort Controls */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <div style={{ 
                display: 'flex', 
                gap: '16px', 
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                {/* Ingredient Search */}
                <div style={{ flex: '1', minWidth: '300px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    marginBottom: '6px' 
                  }}>
                    Search Ingredients
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Search style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '20px',
                      height: '20px',
                      color: '#6b7280'
                    }} />
                    <input
                      type="text"
                      value={ingredientSearchQuery}
                      onChange={(e) => setIngredientSearchQuery(e.target.value)}
                      placeholder="e.g., mercury, hydroquinone, tretinoin..."
                      style={{
                        width: '100%',
                        padding: '12px 12px 12px 44px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#9333ea'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                </div>

                {/* Sort Dropdown */}
                <div style={{ minWidth: '200px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    marginBottom: '6px' 
                  }}>
                    Sort by
                  </label>
                  <select
                    value={ingredientSortBy}
                    onChange={(e) => setIngredientSortBy(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="risk">Risk Level</option>
                    <option value="name">Ingredient Name</option>
                    <option value="bannedYear">Banned Year</option>
                  </select>
                </div>

                {/* Sort Direction Toggle */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    marginBottom: '6px' 
                  }}>
                    Order
                  </label>
                  <button
                    onClick={() => setIngredientSortDirection(ingredientSortDirection === 'asc' ? 'desc' : 'asc')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minWidth: '120px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.borderColor = '#9333ea';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'white';
                      e.target.style.borderColor = '#d1d5db';
                    }}
                    title={`Currently sorting ${ingredientSortDirection === 'asc' ? 'ascending (low to high)' : 'descending (high to low)'}`}
                  >
                    {ingredientSortDirection === 'asc' ? (
                      <>
                        <ArrowUp style={{ width: '16px', height: '16px' }} />
                        <span>Low to High</span>
                      </>
                    ) : (
                      <>
                        <ArrowDown style={{ width: '16px', height: '16px' }} />
                        <span>High to Low</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Results Summary */}
              <div style={{ marginTop: '16px', fontSize: '14px', color: '#6b7280' }}>
                {ingredientSearchQuery ? (
                  `Found ${getFilteredAndSortedIngredients().length} ingredients matching "${ingredientSearchQuery}"`
                ) : (
                  `Showing ${getFilteredAndSortedIngredients().length} total ingredients`
                )}
                {' • '}
                Sorted by {ingredientSortBy.replace(/([A-Z])/g, ' $1').toLowerCase()} ({ingredientSortDirection === 'asc' ? 'low to high' : 'high to low'})
              </div>
            </div>

            {loading ? <LoadingSpinner /> : (
              <div className="ingredients-grid">
                {getFilteredAndSortedIngredients().map((ingredient, idx) => {
                  const formattedIngredient = formatIngredient(ingredient);
                  return (
                    <div key={idx} className="ingredient-card">
                      <div className="ingredient-header">
                        <h3 className="ingredient-name">{formattedIngredient.name}</h3>
                        <span className={`risk-badge ${formattedIngredient.risk}`}>
                          {formattedIngredient.risk === 'high' ? 'High Risk' : 
                           formattedIngredient.risk === 'medium' ? 'Medium Risk' : 'Low Risk'}
                        </span>
                      </div>
                      
                      <div>
                        <p className="ingredient-effects-label">Health Effects:</p>
                        <p className="ingredient-effects">{formattedIngredient.effects}</p>
                        
                        {formattedIngredient.commonName && (
                          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                            <strong>Also known as:</strong> {formattedIngredient.commonName}
                          </p>
                        )}
                        
                        {formattedIngredient.usage && (
                          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                            <strong>Common usage:</strong> {formattedIngredient.usage}
                          </p>
                        )}

                        {formattedIngredient.alternative && (
                          <p style={{ fontSize: '12px', color: '#059669', marginTop: '8px' }}>
                            <strong>Safer alternatives:</strong> {formattedIngredient.alternative}
                          </p>
                        )}

                        {formattedIngredient.shortRisk && (
                          <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>
                            <strong>Short-term risks:</strong> {formattedIngredient.shortRisk}
                          </p>
                        )}

                        {formattedIngredient.longRisk && (
                          <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>
                            <strong>Long-term risks:</strong> {formattedIngredient.longRisk}
                          </p>
                        )}

                        {formattedIngredient.simpleExplanation && (
                          <p style={{ fontSize: '12px', color: '#4b5563', marginTop: '8px', fontStyle: 'italic' }}>
                            <strong>Simple explanation:</strong> {formattedIngredient.simpleExplanation}
                          </p>
                        )}

                        {formattedIngredient.bannedYear && (
                          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                            <strong>Banned since:</strong> {formattedIngredient.bannedYear}
                          </p>
                        )}
                      </div>
                      
                      <div className="ingredient-footer">
                        <p className="ingredient-note">
                          <AlertTriangle style={{ display: 'inline', width: '12px', height: '12px', marginRight: '4px' }} />
                          {formattedIngredient.banStatus || 'Banned by MOH Malaysia and multiple international health authorities'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {!loading && getFilteredAndSortedIngredients().length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Search style={{ width: '48px', height: '48px', color: '#d1d5db', margin: '0 auto 16px' }} />
                <h3 style={{ color: '#6b7280', marginBottom: '8px', fontSize: '18px' }}>No ingredients found</h3>
                <p style={{ color: '#9ca3af' }}>Try adjusting your search terms to find ingredients</p>
              </div>
            )}
          </div>
        )}

        {/* Brand Safety Tab */}
        {activeTab === 'brands' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>
                Brand Safety Overview
              </h2>
              <p style={{ color: '#6b7280' }}>
                Explore brand reliability and safety records to make informed decisions
              </p>
            </div>

            {/* Brand Search and Sort Controls */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <div style={{ 
                display: 'flex', 
                gap: '16px', 
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                {/* Brand Search */}
                <div style={{ flex: '1', minWidth: '300px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    marginBottom: '6px' 
                  }}>
                    Search Brands
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Search style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '20px',
                      height: '20px',
                      color: '#6b7280'
                    }} />
                    <input
                      type="text"
                      value={brandSearchQuery}
                      onChange={(e) => setBrandSearchQuery(e.target.value)}
                      placeholder="e.g., Maybelline, L'Oreal, Unilever..."
                      style={{
                        width: '100%',
                        padding: '12px 12px 12px 44px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#9333ea'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                </div>

                {/* Sort Dropdown */}
                <div style={{ minWidth: '200px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    marginBottom: '6px' 
                  }}>
                    Sort by
                  </label>
                  <select
                    value={brandSortBy}
                    onChange={(e) => setBrandSortBy(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="totalProducts">Total Products</option>
                    <option value="approvedProducts">Approved Products</option>
                    <option value="cancelledProducts">Cancelled Products</option>
                    <option value="cancellationRate">Cancellation Rate</option>
                  </select>
                </div>

                {/* Sort Direction Toggle */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    marginBottom: '6px' 
                  }}>
                    Order
                  </label>
                  <button
                    onClick={() => setBrandSortDirection(brandSortDirection === 'asc' ? 'desc' : 'asc')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minWidth: '120px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.borderColor = '#9333ea';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'white';
                      e.target.style.borderColor = '#d1d5db';
                    }}
                    title={`Currently sorting ${brandSortDirection === 'asc' ? 'ascending (low to high)' : 'descending (high to low)'}`}
                  >
                    {brandSortDirection === 'asc' ? (
                      <>
                        <ArrowUp style={{ width: '16px', height: '16px' }} />
                        <span>Low to High</span>
                      </>
                    ) : (
                      <>
                        <ArrowDown style={{ width: '16px', height: '16px' }} />
                        <span>High to Low</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Results Summary */}
              <div style={{ marginTop: '16px', fontSize: '14px', color: '#6b7280' }}>
                {brandSearchQuery ? (
                  `Found ${getFilteredAndSortedBrands().length} brands matching "${brandSearchQuery}"`
                ) : (
                  `Showing ${getFilteredAndSortedBrands().length} total brands`
                )}
                {' • '}
                Sorted by {brandSortBy.replace(/([A-Z])/g, ' $1').toLowerCase()} ({brandSortDirection === 'asc' ? 'low to high' : 'high to low'})
              </div>
            </div>

            {/* Brand Cards Grid */}
            {loading && <LoadingSpinner />}
            
            {!loading && (
              <div>
                {/* Brand Pagination - Top */}
                <BrandPaginationComponent />

                <div className="brands-grid">
                  {getBrandPaginatedResults().map((brandStat) => {
                    const formatted = formatBrandStat(brandStat);
                    return (
                      <div key={brandStat.brand} className="brand-card">
                        {/* Brand Header */}
                        <div className="brand-header">
                          <h3 className="brand-name">{formatted.brand}</h3>
                          <div className={`brand-icon ${getBrandRiskLevel(formatted.cancellationRate)}`}>
                            {getBrandIcon(formatted.cancellationRate)}
                          </div>
                        </div>

                        {/* Brand Warning for Harmful Ingredients History */}
                        {brandHistoryCache[formatted.brand] && 
                         brandHistoryCache[formatted.brand].harmful_ingredients && 
                         brandHistoryCache[formatted.brand].harmful_ingredients.length > 0 && (
                          <div 
                            className="brand-warning-alert" 
                            style={{ 
                              background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                              border: '1px solid #fca5a5',
                              borderRadius: '8px',
                              padding: '12px',
                              margin: '12px 0',
                              fontSize: '12px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                              <AlertTriangle 
                                style={{ 
                                  width: '16px', 
                                  height: '16px', 
                                  color: '#dc2626',
                                  flexShrink: 0,
                                  marginTop: '1px'
                                }} 
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#dc2626', marginBottom: '4px' }}>
                                  Previously Used Harmful Ingredients
                                </div>
                                <div style={{ fontSize: '11px', color: '#7f1d1d', lineHeight: '1.4' }}>
                                  {brandHistoryCache[formatted.brand].harmful_ingredients.slice(0, 2)
                                    .map(ing => ing.ingredient).join(', ')}
                                  {brandHistoryCache[formatted.brand].harmful_ingredients.length > 2 && 
                                    ` +${brandHistoryCache[formatted.brand].harmful_ingredients.length - 2} more`}
                                  {' '}in cancelled products
                                </div>
                                <div style={{ fontSize: '10px', color: '#991b1b', marginTop: '4px', opacity: 0.8 }}>
                                  {brandHistoryCache[formatted.brand].total_cancellation_ingredients} harmful ingredient{brandHistoryCache[formatted.brand].total_cancellation_ingredients > 1 ? 's' : ''} found
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Loading indicator for brand warnings */}
                        {brandWarningsLoading && (
                          <div style={{ 
                            padding: '8px 12px', 
                            margin: '8px 0',
                            fontSize: '11px', 
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                            Loading brand history...
                          </div>
                        )}

                        {/* Stats Grid */}
                        <div className="brand-stats">
                          <div className="brand-stat">
                            <span className="brand-stat-label">Total Products</span>
                            <span className="brand-stat-value">{formatted.totalProducts}</span>
                          </div>
                          <div className="brand-stat">
                            <span className="brand-stat-label">Approved Products</span>
                            <span className="brand-stat-value">{formatted.approvedProducts}</span>
                          </div>
                          <div className="brand-stat">
                            <span className="brand-stat-label">Cancelled Products</span>
                            <span className="brand-stat-value cancelled">{formatted.cancelledProducts}</span>
                          </div>
                          
                          {/* Cancellation Rate */}
                          <div className="brand-cancellation-rate">
                            <div className="cancellation-rate-header">
                              <span className="cancellation-rate-label">Cancellation Rate</span>
                              <span className={`cancellation-rate-value ${getBrandRiskLevel(formatted.cancellationRate).replace('-risk', '')}`}>
                                {formatted.cancellationRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Brand Pagination - Bottom */}
                <BrandPaginationComponent />
              </div>
            )}

            {/* Empty State */}
            {!loading && getFilteredAndSortedBrands().length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Search style={{ width: '48px', height: '48px', color: '#d1d5db', margin: '0 auto 16px' }} />
                <h3 style={{ color: '#6b7280', marginBottom: '8px', fontSize: '18px' }}>No brands found</h3>
                <p style={{ color: '#9ca3af' }}>Try adjusting your search terms to find brands</p>
              </div>
            )}
          </div>
        )}

        {/* Search Tab - Content Only (Search bar is handled above) */}
        {activeTab === 'search' && !showSavedAlternatives && (
          <div>
            {/* Loading state */}
            {loading && <LoadingSpinner />}

            {/* Search Results with Pagination */}
            {searchResults.length > 0 && !selectedProduct && !loading && (
              <div>
                <div className="results-container">
                  <h3 className="results-title">
                    Found {searchResults.length} product{searchResults.length !== 1 ? 's' : ''} 
                    {getTotalPages() > 1 && ` - Page ${currentPage} of ${getTotalPages()}`}
                  </h3>
                  <button onClick={() => {
                    setSearchResults([]);
                    setUnfilteredResultsCount(0);
                    setShowSuggestions(false);
                    setCurrentPage(1);
                    setProductSortBy('score');
                    setProductSortDirection('desc');
                  }} className="clear-button">
                    Clear results
                  </button>
                </div>

                {/* Product Sort Controls */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'end',
                  marginBottom: '20px',
                  flexWrap: 'wrap'
                }}>
                  {/* Sort By Selector */}
                  <div style={{ minWidth: '200px' }}>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      marginBottom: '6px' 
                    }}>
                      Sort by
                    </label>
                    <select
                      value={productSortBy}
                      onChange={(e) => setProductSortBy(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="score">Reliability Score</option>
                      <option value="name">Product Name</option>
                      <option value="brand">Brand</option>
                      <option value="status">Status</option>
                      <option value="date">Date</option>
                    </select>
                  </div>

                  {/* Sort Direction Toggle */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      marginBottom: '6px' 
                    }}>
                      Order
                    </label>
                    <button
                      onClick={() => setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minWidth: '140px'
                      }}
                      title={`Currently sorting ${productSortDirection === 'asc' ? 'ascending (low to high)' : 'descending (high to low)'}`}
                    >
                      {productSortDirection === 'asc' ? (
                        <>
                          <ArrowUp style={{ width: '16px', height: '16px' }} />
                          <span>Low to High</span>
                        </>
                      ) : (
                        <>
                          <ArrowDown style={{ width: '16px', height: '16px' }} />
                          <span>High to Low</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Results Summary */}
                <div style={{ marginBottom: '16px', fontSize: '14px', color: '#6b7280' }}>
                  Showing {searchResults.length} total products • 
                  Sorted by {productSortBy.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^(\w)/, c => c.toUpperCase())} ({productSortDirection === 'asc' ? 'low to high' : 'high to low'})
                </div>

                {/* Pagination - Top */}
                <PaginationComponent />

                <div className="products-grid">
                  {getPaginatedResults().map(product => (
                    <ProductCard key={product.notif_no} product={product} />
                  ))}
                </div>

                {/* Pagination - Bottom */}
                <PaginationComponent />

                {/* Load More Button for Backend Pagination */}
                {hasNextPage && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    marginTop: '24px',
                    gap: '16px'
                  }}>
                    <button
                      onClick={loadMoreResults}
                      disabled={loading}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: loading ? '#d1d5db' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        if (!loading) {
                          e.target.style.backgroundColor = '#2563eb';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!loading) {
                          e.target.style.backgroundColor = '#3b82f6';
                        }
                      }}
                    >
                      {loading ? 'Loading...' : `Load More Products (${totalCount - searchResults.length} more available)`}
                    </button>
                    
                    {totalCount > 0 && (
                      <div style={{ 
                        fontSize: '14px', 
                        color: '#6b7280',
                        textAlign: 'center'
                      }}>
                        Showing {searchResults.length} of {totalCount} total results
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Product Detail View with Alternatives */}
            {selectedProduct && (
              <div>
                <button 
                  onClick={() => {
                    setSelectedProduct(null);
                    setAlternativeProducts([]);
                    setBrandHistory(null);
                    setShowBrandWarning(false);
                    setBrandWarningLoading(false);
                  }}
                  className="clear-button"
                  style={{ marginBottom: '16px' }}
                >
                  ← Back to results
                </button>

                <div className="product-card" style={{ maxWidth: '800px', margin: '0 auto 24px' }}>
                  <div style={{ marginBottom: '24px' }}>
                    <h2 className="product-name" style={{ fontSize: '24px' }}>{selectedProduct.name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span className="product-brand">{selectedProduct.brand}</span>
                      <span style={{ color: '#9ca3af' }}>|</span>
                      <span className="product-brand">{selectedProduct.notificationNumber}</span>
                    </div>
                  </div>

                  {/* Brand Warning for Harmful Ingredients History */}
                  {brandHistory && brandHistory.harmful_ingredients && brandHistory.harmful_ingredients.length > 0 && (
                    <div 
                      className="warning-alert" 
                      style={{ 
                        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                        border: '2px solid #fca5a5',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}
                    >
                      <AlertTriangle 
                        style={{ 
                          width: '24px', 
                          height: '24px', 
                          color: '#dc2626',
                          flexShrink: 0,
                          marginTop: '2px'
                        }} 
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#dc2626', marginBottom: '8px' }}>
                          ⚠️ Brand History Warning
                        </div>
                        <p style={{ fontSize: '14px', color: '#7f1d1d', margin: '0 0 12px 0', lineHeight: '1.5' }}>
                          This brand has previously used{' '}
                          <strong>
                            {brandHistory.harmful_ingredients.slice(0, 2).map(ing => ing.ingredient).join(', ')}
                            {brandHistory.harmful_ingredients.length > 2 && ` and ${brandHistory.harmful_ingredients.length - 2} other harmful ingredients`}
                          </strong>{' '}
                          in other products that were later cancelled by MOH Malaysia.
                        </p>
                        {showBrandWarning && (
                          <div style={{ 
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '12px',
                            marginTop: '12px'
                          }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#7f1d1d', marginBottom: '8px' }}>
                              Cancelled Products with Harmful Ingredients:
                            </div>
                            {brandHistory.harmful_ingredients.map((ingredient, idx) => (
                              <div key={idx} style={{ marginBottom: '8px', fontSize: '13px', color: '#7f1d1d' }}>
                                <strong>{ingredient.ingredient}</strong>{' '}
                                <span style={{ 
                                  background: ingredient.risk_level === 'HIGH' ? '#dc2626' : 
                                             ingredient.risk_level === 'MEDIUM' ? '#ea580c' : '#65a30d',
                                  color: 'white',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: '500'
                                }}>
                                  {ingredient.risk_level} RISK
                                </span>
                                <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '4px' }}>
                                  Found in {ingredient.product_count} cancelled product{ingredient.product_count > 1 ? 's' : ''}
                                  {ingredient.health_effect && `: ${ingredient.health_effect}`}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => setShowBrandWarning(!showBrandWarning)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#dc2626',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: '0',
                            marginTop: '8px'
                          }}
                        >
                          {showBrandWarning ? 'Hide Details' : 'Show Details'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div 
                    className={`risk-assessment ${getRiskLevel(selectedProduct.riskScore)}`}
                    onClick={() => showStatusExplanation(selectedProduct)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="risk-header">
                      <span className="risk-label">
                        {selectedProduct.status === 'approved' ? 'Product Approved' : 'Product Cancelled'}
                        <Info style={{ width: '16px', height: '16px', marginLeft: '8px', opacity: 0.7 }} />
                      </span>
                      <span className="risk-score">{selectedProduct.riskScore}/100</span>
                    </div>
                    <div className="risk-level">{getRiskText(selectedProduct.riskScore)}</div>
                    <p style={{ fontSize: '14px', marginTop: '8px' }}>
                      {selectedProduct.status === 'approved' 
                        ? `This product has been approved by MOH Malaysia${selectedProduct.approvalDate ? ` as of ${selectedProduct.lastUpdated}` : ''}.`
                        : `This product was cancelled by MOH Malaysia.`
                      }
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                        💡 Click for detailed safety information
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setScoreCalculationData(selectedProduct);
                          setShowScoreExplanation(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '12px',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0
                        }}
                      >
                        How this score was calculated
                      </button>
                    </div>
                  </div>

                  {selectedProduct.harmfulIngredients && selectedProduct.harmfulIngredients.length > 0 && (
                    <div className="harmful-ingredients">
                      <div className="harmful-header">
                        <AlertTriangle style={{ width: '20px', height: '20px' }} />
                        <span className="harmful-title">Harmful Ingredients Detected</span>
                      </div>
                      {selectedProduct.harmfulIngredients.map((ingredient, idx) => {
                        const ingredientInfo = ingredients.find(ing => 
                          (ing.substance_detected || ing.substance || '').toString().toUpperCase() === ingredient.toString().toUpperCase()
                        );
                        return (
                          <div key={idx} style={{ marginBottom: '12px', padding: '12px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #fecaca' }}>
                            <div 
                              style={{ 
                                fontWeight: '500', 
                                color: '#b91c1c', 
                                marginBottom: '4px',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                showIngredientDetails(ingredient);
                              }}
                              title="Click for detailed ingredient information"
                            >
                              {ingredient.toString().toUpperCase()} 
                              <Info style={{ width: '12px', height: '12px', marginLeft: '4px', display: 'inline' }} />
                            </div>
                            {ingredientInfo && (
                              <p style={{ fontSize: '12px', color: '#6b7280' }}>{ingredientInfo.health_effect}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Alternative Products Section (AC1.4.1) */}
                {alternativeProducts.length > 0 && (
                  <div>
                    <h3 style={{ 
                      fontSize: '20px', 
                      fontWeight: '600', 
                      marginBottom: '16px',
                      color: '#166534'
                    }}>
                      ✅ Safer Alternatives in {selectedProduct.category}
                    </h3>
                    <p style={{ 
                      color: '#6b7280', 
                      marginBottom: '24px',
                      fontSize: '14px'
                    }}>
                      These approved products from different brands in the same category have higher safety ratings:
                    </p>
                    <div className="products-grid">
                      {alternativeProducts.map(product => (
                        <ProductCard 
                          key={product.notif_no} 
                          product={product} 
                          isAlternative={true}
                          showComparisonButton={false} // We'll use click-to-compare instead
                          originalProduct={selectedProduct}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <StatusModal />
      <NoResultsModal />
      <ComparisonModal />
      <IngredientModal />
      <ScoreExplanationModal />

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p className="footer-main">
            Data sourced from Ministry of Health Malaysia (MOH) • Last updated: January 2025
          </p>
          <p className="footer-sub">
            For medical advice, please consult with healthcare professionals
          </p>
        </div>
      </footer>
    </div>
  );
};


export default CosmeticSafetyApp;