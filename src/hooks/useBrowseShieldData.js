import { useCallback, useEffect, useState } from 'react';
import {
  getDashboardData,
  getLatestScan,
  getScanById,
  getThreatReport,
  listScanResults,
} from '../lib/api/scanRepository';

const DASHBOARD_REFRESH_INTERVAL_MS = 5000;

function createAsyncState() {
  return {
    loading: true,
    error: '',
  };
}

export function useDashboardData() {
  const [state, setState] = useState({
    ...createAsyncState(),
    mode: 'demo',
    latestScan: null,
    recentAlerts: [],
    threatStats: [],
    status: {
      extension: 'Awaiting scan',
      protection: 'Demo mode',
      alertsToday: 0,
    },
    analytics: {
      scansToday: 0,
      flaggedToday: 0,
      highRiskThisWeek: 0,
      mostCommonThreatCategory: 'safe',
      trustedDomainsCount: 0,
      falsePositiveCount: 0,
      actionBreakdown: [],
      scanTrend: [],
      topFlaggedDomains: [],
    },
    actions: [],
    feedback: [],
    trustedSites: [],
    recommendations: [],
  });

  const refresh = useCallback(async ({ silent = false } = {}) => {
    setState((current) => ({
      ...current,
      loading: silent ? current.loading : true,
      error: '',
    }));

    try {
      const data = await getDashboardData();
      setState({
        loading: false,
        error: '',
        ...data,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message ?? 'Unable to load dashboard data.',
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refresh({ silent: true });
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      refresh({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh({ silent: true });
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refresh]);

  return {
    ...state,
    refresh,
  };
}

export function useHistoryData({ threatType, threatCategory, riskLevel, userAction, trustedStatus, search, refreshToken = 0 }) {
  const [state, setState] = useState({
    ...createAsyncState(),
    mode: 'demo',
    scans: [],
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: '' }));

      try {
        const scans = await listScanResults({
          threatType,
          threatCategory,
          riskLevel,
          userAction,
          trustedStatus,
          search,
          limit: 100,
        });

        if (!active) {
          return;
        }

        setState({
          loading: false,
          error: '',
          mode: 'ready',
          scans,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          error: error.message ?? 'Unable to load scan history.',
          mode: 'error',
          scans: [],
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [threatType, threatCategory, riskLevel, userAction, trustedStatus, search, refreshToken]);

  return state;
}

export function useThreatDetails(scanId, refreshToken = 0) {
  const [state, setState] = useState({
    ...createAsyncState(),
    mode: 'demo',
    scan: null,
    actions: [],
    feedback: [],
    trustedSite: null,
    latestFeedback: null,
    latestAction: '',
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: '' }));

      try {
        const report = scanId ? await getThreatReport(scanId) : await getThreatReport();

        if (!active) {
          return;
        }

        setState({
          loading: false,
          error: report ? '' : 'No scan record was found for this threat report.',
          mode: 'ready',
          scan: report,
          actions: report?.actions ?? [],
          feedback: report?.feedback ?? [],
          trustedSite: report?.trustedSite ?? null,
          latestFeedback: report?.latestFeedback ?? null,
          latestAction: report?.latestAction ?? '',
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          error: error.message ?? 'Unable to load the threat report.',
          mode: 'error',
          scan: null,
          actions: [],
          feedback: [],
          trustedSite: null,
          latestFeedback: null,
          latestAction: '',
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [scanId, refreshToken]);

  return state;
}
