async function req(method, url, body) {
  const opts = {
    method,
    headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Profiles
export const api = {
  profiles: {
    list:   ()           => req('GET',    '/api/profiles'),
    create: (name)       => req('POST',   '/api/profiles', { name }),
    update: (id, name)   => req('PUT',    `/api/profiles/${id}`, { name }),
    delete: (id)         => req('DELETE', `/api/profiles/${id}`),
  },

  accounts: {
    list:   (profileId)                          => req('GET',    `/api/accounts?profileId=${profileId}`),
    create: (profileId, name, initial_balance)   => req('POST',   '/api/accounts', { profileId, name, initial_balance }),
    update: (id, name, initial_balance)          => req('PUT',    `/api/accounts/${id}`, { name, initial_balance }),
    delete: (id)                                 => req('DELETE', `/api/accounts/${id}`),
  },

  groups: {
    list:   (profileId)                               => req('GET',    `/api/groups?profileId=${profileId}`),
    create: (profileId, name, sort_order, is_income)  => req('POST',   '/api/groups', { profileId, name, sort_order, is_income }),
    update: (id, name, sort_order, is_income)         => req('PUT',    `/api/groups/${id}`, { name, sort_order, is_income }),
    delete: (id)                                      => req('DELETE', `/api/groups/${id}`),
  },

  categories: {
    list:   (profileId, groupId)                                      => req('GET',    `/api/categories?profileId=${profileId}${groupId ? `&groupId=${groupId}` : ''}`),
    create: (profileId, groupId, name, monthly_target, is_income)     => req('POST',   '/api/categories', { profileId, groupId, name, monthly_target, is_income }),
    update: (id, fields)                                              => req('PUT',    `/api/categories/${id}`, fields),
    delete: (id)                                                      => req('DELETE', `/api/categories/${id}`),
  },

  budget: {
    get:           (profileId, month)              => req('GET',  `/api/budget/${profileId}/${month}`),
    setTarget:     (profileId, month, categoryId, target) => req('PUT', `/api/budget/${profileId}/${month}/${categoryId}`, { target }),
    applyRecurring: (profileId, month)             => req('POST', `/api/budget/${profileId}/${month}/apply-recurring`),
    copyTargets:   (profileId, month)              => req('POST', `/api/budget/${profileId}/${month}/copy-targets`),
  },

  transactions: {
    list:   (profileId, month, accountId) => {
      let url = `/api/transactions?profileId=${profileId}`;
      if (accountId) url += `&accountId=${accountId}`;
      else if (month) url += `&month=${month}`;
      return req('GET', url);
    },
    create: (t)                => req('POST',   '/api/transactions', t),
    update: (id, t)            => req('PUT',    `/api/transactions/${id}`, t),
    delete: (id)               => req('DELETE', `/api/transactions/${id}`),
  },

  transfers: {
    create: (t) => req('POST', '/api/transfers', t),
  },

  import: {
    parse: (bank, file) => {
      const form = new FormData();
      form.append('bank', bank);
      form.append('file', file);
      return req('POST', '/api/import/parse', form);
    },
    save: (profileId, accountId, transactions) =>
      req('POST', '/api/import/save', { profileId, accountId, transactions }),
  },

  rules: {
    list:   (profileId)                    => req('GET',    `/api/rules?profileId=${profileId}`),
    create: (profileId, keyword, categoryId) => req('POST', '/api/rules', { profileId, keyword, categoryId }),
    delete: (id)                           => req('DELETE', `/api/rules/${id}`),
  },
};
