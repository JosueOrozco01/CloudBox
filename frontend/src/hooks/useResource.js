import { useEffect, useState } from 'react';
export function useResource(loader, dependencies = []) {
  const [state, setState] = useState({
    data: null,
    error: '',
    key: null
  });
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([...dependencies, revision]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(loader).then(data => {
      if (active) setState({
        data,
        error: '',
        key
      });
    }).catch(error => {
      if (active) setState({
        data: null,
        error: error.message,
        key
      });
    });
    return () => {
      active = false;
    };
    // Loaders intentionally follow the caller's explicit dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : '',
    loading: state.key !== key,
    refresh: () => setRevision(r => r + 1)
  };
}
