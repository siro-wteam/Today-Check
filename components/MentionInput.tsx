import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { colors, borderRadius } from '@/constants/colors';

interface MentionToken {
  type: 'mention';
  text: string; // "@아빠"
  memberId: string;
  memberName: string;
  startIndex: number;
  endIndex: number;
}

interface TextSegment {
  type: 'text' | 'mention';
  text: string;
  mentionData?: {
    memberId: string;
    memberName: string;
  };
}

interface MentionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
  mentions: Array<{ memberId: string; memberName: string }>; // Selected assignees
  onMentionRemove?: (memberId: string) => void;
  style?: any;
}

export function MentionInput({
  value,
  onChangeText,
  placeholder,
  editable = true,
  autoFocus = false,
  mentions,
  onMentionRemove,
  style,
}: MentionInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const lastValueRef = useRef(value);
  const lastSelectionRef = useRef({ start: 0, end: 0 });
  const isDeletingRef = useRef(false);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

  // Sync external value
  useEffect(() => {
    if (value !== lastValueRef.current) {
      setInputValue(value);
      lastValueRef.current = value;
    }
  }, [value]);

  // Apply pending selection
  useEffect(() => {
    if (pendingSelectionRef.current) {
      setSelection(pendingSelectionRef.current);
      pendingSelectionRef.current = null;
    }
  }, [inputValue]);

  // Parse value into segments (text and mentions)
  const parseSegments = useCallback((): TextSegment[] => {
    if (!inputValue) return [];

    const segments: TextSegment[] = [];
    
    // Find all mentions in the value
    const mentionTokens: MentionToken[] = [];
    
    mentions.forEach(({ memberId, memberName }) => {
      const mentionText = `@${memberName}`;
      let searchIndex = 0;
      
      while (true) {
        const index = inputValue.indexOf(mentionText, searchIndex);
        if (index === -1) break;
        
        // Check if it's a complete mention (followed by space or end of string)
        const afterMention = inputValue[index + mentionText.length];
        if (afterMention === ' ' || afterMention === undefined || afterMention === '') {
          // Check if it's not overlapping with existing tokens
          const isOverlapping = mentionTokens.some(
            token => (index >= token.startIndex && index < token.endIndex) ||
                     (index + mentionText.length > token.startIndex && index + mentionText.length <= token.endIndex)
          );
          
          if (!isOverlapping) {
            mentionTokens.push({
              type: 'mention',
              text: mentionText,
              memberId,
              memberName,
              startIndex: index,
              endIndex: index + mentionText.length,
            });
          }
        }
        searchIndex = index + 1;
      }
    });

    // Sort mentions by position
    mentionTokens.sort((a, b) => a.startIndex - b.startIndex);

    // Build segments
    let textIndex = 0;
    mentionTokens.forEach((token) => {
      // Add text before mention
      if (token.startIndex > textIndex) {
        const textSegment = inputValue.slice(textIndex, token.startIndex);
        if (textSegment) {
          segments.push({ type: 'text', text: textSegment });
        }
      }

      // Add mention
      segments.push({
        type: 'mention',
        text: token.text,
        mentionData: {
          memberId: token.memberId,
          memberName: token.memberName,
        },
      });

      textIndex = token.endIndex;
    });

    // Add remaining text
    if (textIndex < inputValue.length) {
      const textSegment = inputValue.slice(textIndex);
      if (textSegment) {
        segments.push({ type: 'text', text: textSegment });
      }
    }

    return segments.length > 0 ? segments : [{ type: 'text', text: inputValue }];
  }, [inputValue, mentions]);

  // Handle text change
  const handleChangeText = useCallback((text: string) => {
    const wasDeleting = isDeletingRef.current;
    isDeletingRef.current = false;
    
    setInputValue(text);
    lastValueRef.current = text;
    onChangeText(text);
  }, [onChangeText]);

  // Handle selection change - detect backspace on mention
  const handleSelectionChange = useCallback((e: any) => {
    const newSelection = e.nativeEvent.selection;
    const oldSelection = lastSelectionRef.current;
    const oldValue = lastValueRef.current;
    
    // Check if this is a deletion (value decreased by 1, selection moved back)
    const isDeletion = 
      inputValue.length === oldValue.length - 1 &&
      newSelection.start === oldSelection.start - 1 &&
      newSelection.start === newSelection.end &&
      oldSelection.start === oldSelection.end;
    
    lastSelectionRef.current = newSelection;
    setSelection(newSelection);
    
    // If deleting and cursor is on a mention, delete the whole mention
    if (isDeletion && newSelection.start >= 0) {
      const segments = parseSegments();
      let charIndex = 0;
      
      for (const segment of segments) {
        if (segment.type === 'mention') {
          const mentionStart = charIndex;
          const mentionEnd = charIndex + segment.text.length;
          
          // If cursor is at the start or inside a mention, delete the whole mention
          if (newSelection.start >= mentionStart && newSelection.start < mentionEnd) {
            isDeletingRef.current = true;
            const newValue = oldValue.slice(0, mentionStart) + oldValue.slice(mentionEnd);
            handleChangeText(newValue);
            if (onMentionRemove && segment.mentionData) {
              onMentionRemove(segment.mentionData.memberId);
            }
            // Set cursor position after deletion using selection prop
            pendingSelectionRef.current = { start: mentionStart, end: mentionStart };
            return;
          }
          
          charIndex = mentionEnd;
        } else {
          charIndex += segment.text.length;
        }
      }
    }
  }, [inputValue, parseSegments, handleChangeText, onMentionRemove]);

  // Handle key press (for web)
  const handleKeyPress = useCallback((e: any) => {
    if (Platform.OS === 'web' && e.nativeEvent.key === 'Backspace') {
      const segments = parseSegments();
      let charIndex = 0;
      
      for (const segment of segments) {
        if (segment.type === 'mention') {
          const mentionStart = charIndex;
          const mentionEnd = charIndex + segment.text.length;
          
          // If cursor is at the start or inside a mention, delete the whole mention
          if (selection.start >= mentionStart && selection.start <= mentionEnd && selection.start === selection.end) {
            e.preventDefault?.();
            isDeletingRef.current = true;
            const newValue = inputValue.slice(0, mentionStart) + inputValue.slice(mentionEnd);
            handleChangeText(newValue);
            if (onMentionRemove && segment.mentionData) {
              onMentionRemove(segment.mentionData.memberId);
            }
            // Set cursor position after deletion
            pendingSelectionRef.current = { start: mentionStart, end: mentionStart };
            return;
          }
          
          charIndex = mentionEnd;
        } else {
          charIndex += segment.text.length;
        }
      }
    }
  }, [inputValue, selection, parseSegments, handleChangeText, onMentionRemove]);

  // Handle mention token click
  const handleMentionClick = useCallback((segment: TextSegment, charIndex: number) => {
    if (segment.type === 'mention' && segment.mentionData) {
      // Remove the mention
      const mentionStart = charIndex;
      const mentionEnd = charIndex + segment.text.length;
      const newValue = inputValue.slice(0, mentionStart) + inputValue.slice(mentionEnd);
      handleChangeText(newValue);
      if (onMentionRemove) {
        onMentionRemove(segment.mentionData.memberId);
      }
      // Set cursor position after deletion
      pendingSelectionRef.current = { start: mentionStart, end: mentionStart };
    }
  }, [inputValue, handleChangeText, onMentionRemove]);

  const segments = parseSegments();
  const hasMentions = segments.some(s => s.type === 'mention');

  return (
    <View style={[styles.container, style]}>
      {/* Visual representation with tokens (shown when focused and has mentions) */}
      {isFocused && hasMentions && (
        <View style={styles.tokenOverlay} pointerEvents="box-none">
          <View style={styles.tokenContainer}>
            {segments.map((segment, index) => {
              let charIndex = 0;
              // Calculate character index for this segment
              for (let i = 0; i < index; i++) {
                charIndex += segments[i].text.length;
              }
              
              if (segment.type === 'mention') {
                return (
                  <Pressable
                    key={`mention-${index}`}
                    onPress={() => handleMentionClick(segment, charIndex)}
                    style={styles.mentionToken}
                  >
                    <Text style={styles.mentionText}>{segment.text}</Text>
                  </Pressable>
                );
              } else {
                return (
                  <Text key={`text-${index}`} style={styles.regularText}>
                    {segment.text}
                  </Text>
                );
              }
            })}
          </View>
        </View>
      )}

      {/* Actual TextInput */}
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          isFocused && hasMentions && styles.inputWithOverlay,
        ]}
        value={inputValue}
        onChangeText={handleChangeText}
        onKeyPress={handleKeyPress}
        onSelectionChange={handleSelectionChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        editable={editable}
        autoFocus={autoFocus}
        multiline={false}
        selection={pendingSelectionRef.current || selection}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.xl,
    minHeight: 56,
    overflow: 'hidden',
  },
  tokenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    zIndex: 1,
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  mentionToken: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    marginBottom: 2,
  },
  mentionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  regularText: {
    color: colors.textMain,
    fontSize: 16,
  },
  input: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.xl,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.textMain,
    minHeight: 56,
  },
  inputWithOverlay: {
    color: 'transparent', // Hide text when overlay is shown
  },
});
