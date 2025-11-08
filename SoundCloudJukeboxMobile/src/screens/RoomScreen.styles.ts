import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

export const roomScreenStyles = StyleSheet.create({
  youtubePlayerContainer: {
    marginBottom: IS_MOBILE ? 12 : 16,
    width: '100%',
  },
  hiddenPlayer: {
    position: 'absolute',
    left: -9999,
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: -1,
    marginBottom: 0,
  },
  container: {
    flex: 1,
  },
  header: {
    padding: IS_MOBILE ? 12 : 16,
    paddingTop: Platform.OS === 'web' ? 16 : (IS_MOBILE ? 50 : 60),
    paddingBottom: IS_MOBILE ? 12 : 16,
    marginBottom: IS_MOBILE ? 4 : 6,
    elevation: 8,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.25)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    }),
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: IS_MOBILE ? 8 : 6,
    flexWrap: IS_MOBILE ? 'wrap' : 'nowrap',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: IS_MOBILE ? 8 : 12,
    minWidth: 0,
  },
  backButton: {
    margin: 0,
  },
  roomTitle: {
    fontSize: IS_MOBILE ? 20 : 24,
    fontWeight: '700',
    minWidth: 0,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IS_MOBILE ? 6 : 10,
    flexWrap: 'wrap',
  },
  iconButtonWrapper: {
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      transition: 'background-color 0.2s ease',
      cursor: 'pointer',
    } : {}),
  },
  iconButton: {
    margin: 0,
    width: 40,
    height: 40,
  },
  settingsButton: {
    margin: 0,
  },
  shareButton: {
    margin: 0,
  },
  connectionStatus: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: IS_MOBILE ? 8 : 10,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 0px 8px currentColor',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 3,
    }),
  },
  connectingIndicator: {
    marginTop: 8,
  },
  roomId: {
    fontSize: IS_MOBILE ? 12 : 14,
    marginTop: IS_MOBILE ? 8 : 4,
  },
  userCountChip: {
    height: IS_MOBILE ? 32 : 36,
    marginRight: IS_MOBILE ? 4 : 6,
    ...(Platform.OS === 'web' ? {
      cursor: 'default',
    } : {}),
  },
  userCountChipText: {
    fontSize: IS_MOBILE ? 12 : 13,
    fontWeight: '600',
  },
  tabs: {
    borderBottomWidth: 1,
    marginBottom: IS_MOBILE ? 2 : 0,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    } : {}),
  },
  tabsScrollView: {
    flexGrow: 0,
    ...(Platform.OS === 'web' && !IS_MOBILE ? {
      width: '100%',
    } : {}),
  },
  tabsScrollContent: {
    flexDirection: 'row',
    paddingHorizontal: IS_MOBILE ? 4 : 8,
    paddingTop: IS_MOBILE ? 6 : 4,
    paddingBottom: IS_MOBILE ? 6 : 4,
    ...(Platform.OS === 'web' && !IS_MOBILE ? {
      justifyContent: 'space-evenly',
      minWidth: SCREEN_WIDTH,
    } : {}),
  },
  tabButton: {
    flex: IS_MOBILE ? 0 : undefined,
    minWidth: IS_MOBILE ? 80 : 100,
    maxWidth: IS_MOBILE ? undefined : 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IS_MOBILE ? 8 : 10,
    paddingHorizontal: IS_MOBILE ? 6 : 10,
    borderRadius: 12,
    marginHorizontal: IS_MOBILE ? 4 : 8,
    marginBottom: 2,
    ...(Platform.OS === 'web' && !IS_MOBILE ? {
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'all 0.2s ease',
      flexGrow: 1,
      flexShrink: 0,
    } : Platform.OS === 'web' ? {
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'all 0.2s ease',
    } : {}),
  },
  tabIcon: {
    marginRight: 6,
  },
  tabIconContainer: {
    position: 'relative',
    marginRight: 6,
  },
  chatBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
  },
  tabButtonText: {
    fontSize: IS_MOBILE ? 13 : 14,
    fontWeight: '500',
  },
  tabContent: {
    flex: 1,
    paddingTop: IS_MOBILE ? 4 : 0,
    paddingBottom: IS_MOBILE ? 16 : 32,
  },
  card: {
    marginHorizontal: IS_MOBILE ? 12 : 16,
    marginTop: IS_MOBILE ? 12 : 12,
    marginBottom: IS_MOBILE ? 12 : 12,
    borderRadius: 24,
    elevation: 8,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.25)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: IS_MOBILE ? 10 : 12,
    gap: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectionTitle: {
    fontSize: IS_MOBILE ? 16 : 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 40,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: IS_MOBILE ? 13 : 14,
    fontWeight: '700',
  },
  queueList: {
    maxHeight: IS_MOBILE ? 300 : 400,
  },
  queueCard: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.15)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    }),
  },
  queueCardContent: {
    padding: IS_MOBILE ? 12 : 16,
  },
  historyCard: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.15)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    }),
  },
  historyCardContent: {
    padding: IS_MOBILE ? 12 : 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IS_MOBILE ? 24 : 32,
    gap: 10,
  },
  emptyQueue: {
    textAlign: 'center',
    fontSize: IS_MOBILE ? 13 : 14,
    fontWeight: '500',
  },
  urlInput: {
    marginBottom: IS_MOBILE ? 12 : 16,
  },
  addButton: {
    marginTop: 8,
  },
  permissionNoticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  permissionNotice: {
    fontSize: IS_MOBILE ? 11 : 12,
    flex: 1,
    fontWeight: '500',
  },
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  infoNoticeText: {
    fontSize: IS_MOBILE ? 12 : 14,
    flex: 1,
    fontWeight: '500',
  },
  usersList: {
    maxHeight: IS_MOBILE ? 250 : 300,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestSent: {
    fontSize: IS_MOBILE ? 11 : 12,
    fontStyle: 'italic',
  },
  requestActions: {
    flexDirection: 'row',
    gap: IS_MOBILE ? 2 : 4,
    flexWrap: 'wrap',
  },
  friendsTabs: {
    flexDirection: 'row',
    gap: IS_MOBILE ? 6 : 8,
    marginBottom: IS_MOBILE ? 12 : 16,
  },
  friendsTabButton: {
    flex: 1,
    minWidth: IS_MOBILE ? 100 : 120,
  },
  friendsList: {
    maxHeight: IS_MOBILE ? 300 : 400,
  },
  settingItem: {
    marginVertical: IS_MOBILE ? 12 : 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: IS_MOBILE ? 'wrap' : 'nowrap',
  },
  settingLabel: {
    fontSize: IS_MOBILE ? 14 : 16,
    fontWeight: '500',
    flex: 1,
    marginRight: IS_MOBILE ? 8 : 0,
  },
  settingDescription: {
    fontSize: IS_MOBILE ? 12 : 14,
    marginTop: 4,
  },
  divider: {
    marginVertical: IS_MOBILE ? 6 : 8,
  },
  adminsList: {
    maxHeight: IS_MOBILE ? 150 : 200,
    marginVertical: IS_MOBILE ? 12 : 16,
  },
  addAdminForm: {
    marginTop: IS_MOBILE ? 12 : 16,
  },
  adminInput: {
    marginBottom: IS_MOBILE ? 6 : 8,
  },
  addAdminButton: {
    marginTop: 8,
  },
  saveButton: {
    marginTop: IS_MOBILE ? 12 : 16,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  centerIcon: {
    marginBottom: 16,
  },
  noAccess: {
    textAlign: 'center',
    fontSize: IS_MOBILE ? 14 : 16,
    marginVertical: IS_MOBILE ? 16 : 20,
  },
  noAccessSubtext: {
    textAlign: 'center',
    fontSize: IS_MOBILE ? 12 : 14,
    marginTop: 8,
  },
  playlistHeader: {
    marginBottom: IS_MOBILE ? 12 : 16,
  },
  playlistDescription: {
    fontSize: IS_MOBILE ? 12 : 14,
    marginTop: 8,
    marginBottom: 4,
  },
  trackCount: {
    fontSize: IS_MOBILE ? 11 : 12,
    marginTop: 4,
  },
  errorText: {
    marginBottom: IS_MOBILE ? 12 : 16,
    textAlign: 'center',
    fontSize: IS_MOBILE ? 13 : 14,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: IS_MOBILE ? 12 : 16,
    fontSize: IS_MOBILE ? 13 : 14,
  },
  boostContainer: {
    padding: IS_MOBILE ? 16 : 12,
  },
  boostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: IS_MOBILE ? 16 : 16,
  },
  boostTitle: {
    fontSize: IS_MOBILE ? 18 : 20,
    fontWeight: '700',
  },
  boostDescription: {
    fontSize: IS_MOBILE ? 13 : 14,
    lineHeight: IS_MOBILE ? 18 : 20,
    marginBottom: IS_MOBILE ? 20 : 20,
  },
  boostButton: {
    marginTop: 8,
    borderRadius: 12,
  },
  fabContainer: {
    position: 'absolute',
    bottom: IS_MOBILE ? 16 : 24,
    left: IS_MOBILE ? 16 : 24,
    zIndex: 999,
    ...(Platform.OS === 'web' ? {
      position: 'fixed',
    } : {}),
  },
  queueItem: {
    marginVertical: IS_MOBILE ? 8 : 10,
    marginHorizontal: IS_MOBILE ? 4 : 8,
    borderRadius: 16,
    padding: IS_MOBILE ? 14 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      ':hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.2)',
      },
    } : {}),
  },
  queueItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IS_MOBILE ? 12 : 16,
    flex: 1,
  },
  queueItemNumber: {
    width: IS_MOBILE ? 36 : 40,
    height: IS_MOBILE ? 36 : 40,
    borderRadius: IS_MOBILE ? 18 : 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  nextIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  queueNumber: {
    fontSize: IS_MOBILE ? 13 : 15,
    fontWeight: '700',
  },
  queueItemThumbnail: {
    borderRadius: 12,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 3,
    }),
  },
  historyThumbnail: {
    opacity: 0.7,
  },
  queueItemDetails: {
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  queueItemTitle: {
    fontSize: IS_MOBILE ? 15 : 17,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  queueItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  queueItemDescription: {
    fontSize: IS_MOBILE ? 12 : 13,
    fontWeight: '500',
  },
  queueItemRemoveButton: {
    margin: 0,
    marginLeft: 8,
  },
  metaDivider: {
    width: 1,
    height: 12,
    opacity: 0.3,
  },
  nextLabel: {
    fontSize: IS_MOBILE ? 11 : 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyItem: {
    opacity: 0.9,
  },
  historyIconContainer: {
    width: IS_MOBILE ? 36 : 40,
    height: IS_MOBILE ? 36 : 40,
    borderRadius: IS_MOBILE ? 18 : 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replayButton: {
    width: IS_MOBILE ? 40 : 44,
    height: IS_MOBILE ? 40 : 44,
    borderRadius: IS_MOBILE ? 20 : 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      ':hover': {
        transform: 'scale(1.1)',
        backgroundColor: 'rgba(102, 126, 234, 0.3)',
      },
    } : {}),
  },
  scrollContent: {
    flexGrow: 1,
  },
});

