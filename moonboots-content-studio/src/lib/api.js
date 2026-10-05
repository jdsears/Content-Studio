// All app API calls go through here. If the login has expired the app returns to the login screen.
export const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (response.status === 401) {
    response.clone().json()
      .then(data => { if (data?.code === 'login_required') window.dispatchEvent(new Event('cs:logged-out')); })
      .catch(() => {});
  }
  return response;
};

// Call the API and return its JSON, throwing a readable error when it fails
export const apiJson = async (url, options = {}) => {
  const response = await apiFetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.hint = data.hint;
    error.code = data.code;
    throw error;
  }
  return data;
};

export const CLAUDE_NOT_SET = 'Claude is not set up on the server yet. Add ANTHROPIC_API_KEY in Railway > Variables.';
