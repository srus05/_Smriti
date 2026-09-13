/**
 * SMRITI CLIENT ROUTE GUARD & NAVIGATION ENGINE
 * Enforces Role-Based Access Control (RBAC) on protected shells and manages URL routing.
 */

const SmritiRouter = {
  /**
   * Evaluates the current page and enforces role protection
   */
  async enforceRouteGuard() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const requestedRole = params.get('role') || 'elderly_user';

    const auth = window.smritiAuth;
    if (!auth) return;

    // Ensure AuthStateManager initialization is complete
    if (auth.ready) await auth.ready;

    const user = auth.getUser();
    const loading = auth.loading;

    const isSeniorSpace = path.includes('senior-space') || path.endsWith('/senior-space.html');
    const isCaretakerStudio = path.includes('caretaker-studio') || path.endsWith('/caretaker-studio.html');
    const isSpecialistDashboard = path.includes('specialist-dashboard') || path.endsWith('/specialist-dashboard.html');
    const isAuthPage = path.includes('auth') || path.endsWith('/auth.html');

    // 1. Unauthenticated user trying to access a protected shell
    if (!user && (isSeniorSpace || isCaretakerStudio || isSpecialistDashboard)) {
      if (navigator.onLine) {
        console.warn('[Router] Unauthenticated access blocked. Redirecting to auth...');
        const fallbackRole = isSeniorSpace
          ? 'elderly_user'
          : isSpecialistDashboard
            ? 'medical_specialist'
            : 'caretaker';

        window.location.href = `/auth?role=${fallbackRole}`;
        return;
      }

      // Offline: allow Senior Space to load its offline fallback.
      // Other protected shells still require authentication.
      if (isSeniorSpace) {
        return;
      }

      console.warn('[Router] Offline access blocked for protected non-senior route.');
      window.location.href = `/auth?role=${isSpecialistDashboard ? 'medical_specialist' : 'caretaker'}`;
      return;
    }

    // 2. Already authenticated user visiting /auth
    if (user && isAuthPage) {
      const targetRole =
        user.role ||
        localStorage.getItem('smriti_intended_role') ||
        requestedRole ||
        'elderly_user';

      console.log('[Router] Already authenticated. Routing to authorized space:', targetRole);
      this.navigateToRole(targetRole);
      return;
    }

    if (!user) return;

    // 3. Role-Based Route Mismatch:
    // Elderly users cannot access Caretaker Studio or Specialist Dashboard.
    if (
      (isCaretakerStudio || isSpecialistDashboard) &&
      user.role === 'elderly_user'
    ) {
      console.warn(`[Router] RBAC Mismatch: Role '${user.role}' redirected to Senior Space.`);
      window.location.replace('/senior-space');
      return;
    }

    // 4. Caretakers cannot access Senior Space or Specialist Dashboard.
    if (
      (isSeniorSpace || isSpecialistDashboard) &&
      user.role === 'caretaker'
    ) {
      console.warn(`[Router] RBAC Mismatch: Role '${user.role}' redirected to Caretaker Studio.`);
      window.location.replace('/caretaker-studio');
      return;
    }

    // 5. Specialists / healthcare workers cannot access Senior Space or Caretaker Studio.
    if (
      (isSeniorSpace || isCaretakerStudio) &&
      (user.role === 'medical_specialist' || user.role === 'healthcare_worker')
    ) {
      console.warn(`[Router] RBAC Mismatch: Role '${user.role}' redirected to Specialist Dashboard.`);
      window.location.replace('/specialist-dashboard');
      return;
    }
  },

  navigateToRole(role) {
    const targetRole =
      role ||
      localStorage.getItem('smriti_intended_role') ||
      'elderly_user';

    if (targetRole === 'caretaker') {
      window.location.href = '/caretaker-studio';
    } else if (
      targetRole === 'medical_specialist' ||
      targetRole === 'healthcare_worker'
    ) {
      window.location.href = '/specialist-dashboard';
    } else {
      window.location.href = '/senior-space';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  SmritiRouter.enforceRouteGuard();
});

window.SmritiRouter = SmritiRouter;
