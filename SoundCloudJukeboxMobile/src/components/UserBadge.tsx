import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { UserRole, SubscriptionTier } from '../types';
import {
  getRoleDisplayName,
  getRoleColor,
  getTierDisplayName,
  getTierColor,
} from '../utils/permissions';

interface UserBadgeProps {
  role: UserRole;
  tier: SubscriptionTier;
  showLabel?: boolean;
  size?: 'small' | 'medium';
}

export const UserBadge: React.FC<UserBadgeProps> = ({
  role,
  tier,
  showLabel = true,
  size = 'medium',
}) => {
  const chipSize = size === 'small' ? 12 : 14;
  const chipStyle = size === 'small' ? styles.smallChip : styles.chip;

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={styles.label}>
          {getRoleDisplayName(role)} • {getTierDisplayName(tier)}
        </Text>
      )}
      <View style={styles.badges}>
        <Chip
          style={[chipStyle, { backgroundColor: getRoleColor(role) }]}
          textStyle={[styles.chipText, { fontSize: chipSize }]}
        >
          {getRoleDisplayName(role)}
        </Chip>
        <Chip
          style={[chipStyle, { backgroundColor: getTierColor(tier) }]}
          textStyle={[styles.chipText, { fontSize: chipSize }]}
        >
          {getTierDisplayName(tier)}
        </Chip>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: '#666',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    height: 24,
  },
  smallChip: {
    height: 20,
  },
  chipText: {
    color: '#fff',
    fontWeight: '600',
  },
});

