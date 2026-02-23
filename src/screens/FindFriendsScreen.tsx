import { useState, useCallback } from 'react';
import type { Profile } from '../types';
import { Header } from '../components/navigation/Header';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { FollowButton } from '../components/social/FollowButton';
import { searchProfiles } from '../services/socialService';
import { useDebounce } from '../hooks/useDebounce';
import { useEffect } from 'react';

export function FindFriendsScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debouncedQuery = useDebounce(query, 400);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    const data = await searchProfiles(q.trim());
    setResults(data);
    setSearched(true);
    setLoading(false);
  }, []);

  useEffect(() => { search(debouncedQuery); }, [debouncedQuery, search]);

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="Find Friends" showBack />

      <div className="px-4 pt-4">
        <Input
          placeholder="Search by name..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="px-4 pt-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-primary-500" />
          </div>
        ) : searched && results.length === 0 ? (
          <EmptyState
            emoji="🔍"
            title="No runners found"
            description={`No public profiles matching "${query}".`}
          />
        ) : (
          results.map(profile => (
            <div
              key={profile.id}
              className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-lg">
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    : '🏃'}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {profile.display_name || 'Runner'}
                  </p>
                </div>
              </div>
              <FollowButton targetId={profile.id} size="sm" />
            </div>
          ))
        )}

        {!searched && !loading && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 pt-8">
            Search for runners to follow
          </p>
        )}
      </div>
    </div>
  );
}

