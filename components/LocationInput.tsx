/**
 * Inline location input: tap to expand → type → Google Places suggestions below → select or remove.
 * No modal; same form flow as TASK_LOCATION_RECOMMENDATION.md.
 */

import { borderRadius, colors } from '@/constants/colors';
import {
  fetchPlaceAutocomplete,
  fetchPlaceDetails,
  generateSessionToken,
} from '@/lib/api/places';
import { openLocationInMaps } from '@/lib/utils/open-maps';
import { MapPin, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

const DEBOUNCE_MS = 350;

interface LocationInputProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** When true and value is null: do not render "Add location" button (parent shows icon next to title) */
  hideTriggerWhenEmpty?: boolean;
  /** When true and value is null: show search input expanded (opened by parent via icon tap) */
  expandedWhenEmpty?: boolean;
  /** Called when user cancels the expanded empty state so parent can collapse */
  onCollapse?: () => void;
}

export function LocationInput({
  value,
  onChange,
  placeholder = 'Search for a place…',
  hideTriggerWhenEmpty = false,
  expandedWhenEmpty = false,
  onCollapse,
}: LocationInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const effectiveExpanded = (value == null && expandedWhenEmpty) || isExpanded;
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [placeIds, setPlaceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<string | null>(null);

  // One session token per "search session" (expand → type → select/cancel) for Places API billing
  useEffect(() => {
    if (effectiveExpanded) {
      sessionTokenRef.current = generateSessionToken();
    }
  }, [effectiveExpanded]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setPlaceIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const token = sessionTokenRef.current;
    const { suggestions: list, placeIds: ids, error: err } = await fetchPlaceAutocomplete(
      query,
      token
    );
    setSuggestions(list ?? []);
    setPlaceIds(ids ?? []);
    setError(err ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setPlaceIds([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(searchQuery), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, fetchSuggestions]);

  const handleSelect = useCallback(
    async (index: number, item: string) => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      const token = sessionTokenRef.current;
      const placeId = placeIds[index];
      if (token && placeId) {
        const { formattedAddress, error: detailsErr } = await fetchPlaceDetails(placeId, token);
        sessionTokenRef.current = null;
        if (detailsErr) {
          setError(detailsErr);
          return;
        }
        onChange(formattedAddress ?? item);
      } else {
        sessionTokenRef.current = null;
        onChange(item);
      }
      setIsExpanded(false);
      setSearchQuery('');
      setSuggestions([]);
      setPlaceIds([]);
    },
    [onChange, placeIds]
  );

  const handleClear = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    sessionTokenRef.current = null;
    onChange(null);
    setSearchQuery('');
    setSuggestions([]);
    setPlaceIds([]);
    setError(null);
  }, [onChange]);

  const handleExpand = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setIsExpanded(true);
  }, []);

  // Selected location: show chip with remove; tap chip to open in Maps
  const handleOpenMaps = useCallback(() => {
    if (value?.trim()) {
      if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      openLocationInMaps(value);
    }
  }, [value]);

  if (value != null && value.trim() !== '' && !effectiveExpanded) {
    return (
      <View className="flex-row items-center gap-2 flex-wrap">
        <Pressable
          onPress={handleOpenMaps}
          className="flex-row items-center rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 pl-2 pr-1 py-2 flex-1 min-w-0"
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <MapPin size={14} color={colors.textSub} style={{ marginRight: 6 }} />
          <Text
            className="text-gray-700 dark:text-gray-300 flex-1"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ fontSize: 14 }}
          >
            {value}
          </Text>
          <Pressable
            onPress={handleClear}
            className="rounded-full p-1 ml-0.5 items-center justify-center bg-gray-200/40 dark:bg-gray-600/40 active:opacity-70"
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <X size={14} color={colors.textSub} strokeWidth={2.5} />
          </Pressable>
        </Pressable>
        <Pressable
          onPress={handleExpand}
          className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2"
        >
          <Text className="text-gray-600 dark:text-gray-400 text-sm font-medium">Change</Text>
        </Pressable>
      </View>
    );
  }

  // When parent shows icon only: render nothing when empty and not expanded
  if (value == null && hideTriggerWhenEmpty && !expandedWhenEmpty) {
    return null;
  }

  // Add location button (collapsed) - only when not hideTriggerWhenEmpty
  if (value == null && !effectiveExpanded) {
    return (
      <Pressable
        onPress={handleExpand}
        className="flex-row items-center rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-3"
      >
        <MapPin size={18} color={colors.textSub} style={{ marginRight: 10 }} />
        <Text className="text-gray-600 dark:text-gray-400 font-medium">Add location</Text>
      </Pressable>
    );
  }

  // Expanded: input + suggestions list (value is null and expanded, or user tapped Add location)
  const handleCancel = useCallback(() => {
    sessionTokenRef.current = null;
    if (expandedWhenEmpty) {
      onCollapse?.();
    } else {
      setIsExpanded(false);
    }
    setSearchQuery('');
    setSuggestions([]);
    setPlaceIds([]);
  }, [expandedWhenEmpty, onCollapse]);

  return (
    <View>
      <View
        className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex-row items-center px-4 py-2"
        style={{ borderRadius: borderRadius.lg }}
      >
        <MapPin size={18} color={colors.textSub} style={{ marginRight: 10 }} />
        <TextInput
          className="flex-1 text-base text-gray-900 dark:text-white py-2"
          placeholder={placeholder}
          placeholderTextColor={colors.textSub}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
        )}
      </View>
      {error && (
        <Text className="text-red-600 dark:text-red-400 text-sm mt-1 px-1">{error}</Text>
      )}
      {suggestions.length > 0 && (
        <View
          className="mt-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden"
          style={{ maxHeight: 220, borderRadius: borderRadius.lg }}
        >
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => handleSelect(index, item)}
                className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700"
              >
                <Text className="text-gray-800 dark:text-gray-200" numberOfLines={2}>
                  {item}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}
      <Pressable onPress={handleCancel} className="mt-2 py-1">
        <Text className="text-gray-500 dark:text-gray-400 text-sm">Cancel</Text>
      </Pressable>
    </View>
  );
}
