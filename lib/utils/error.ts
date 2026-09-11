/**
 * Utility function to cleanly extract user-facing error messages from API response objects,
 * Axios errors, NestJS exceptions, or generic Javascript Error objects.
 *
 * Checks for `response.data.message` (string or array) as primary source, falling back to
 * `response.data.error`, `err.message`, or the provided fallback.
 */
export function getErrorMessage(err: any, fallbackMessage: string = 'An unexpected error occurred'): string {
  if (!err) return fallbackMessage;
  if (typeof err === 'string') return err.trim() || fallbackMessage;

  // 1. Check nested response data payload (e.g. Axios, fetch, or custom HTTP clients)
  const responseData = err?.response?.data || err?.data;
  if (responseData) {
    if (responseData.message) {
      if (Array.isArray(responseData.message)) {
        const cleanList = responseData.message.filter((m: any) => m && typeof m === 'string');
        if (cleanList.length > 0) {
          return cleanList.join(', ');
        }
      }
      if (typeof responseData.message === 'string' && responseData.message.trim()) {
        return responseData.message.trim();
      }
    }
    if (responseData.error) {
      if (typeof responseData.error === 'string' && responseData.error.trim()) {
        return responseData.error.trim();
      }
      if (typeof responseData.error === 'object') {
        try {
          return JSON.stringify(responseData.error);
        } catch (_) {}
      }
    }
  }

  // 2. Check direct `message` key on the error object itself
  if (err.message) {
    if (Array.isArray(err.message)) {
      const cleanList = err.message.filter((m: any) => m && typeof m === 'string');
      if (cleanList.length > 0) {
        return cleanList.join(', ');
      }
    }
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message.trim();
    }
  }

  // 3. Check direct `error` key on object
  if (err.error) {
    if (typeof err.error === 'string' && err.error.trim()) {
      return err.error.trim();
    }
  }

  return fallbackMessage;
}
