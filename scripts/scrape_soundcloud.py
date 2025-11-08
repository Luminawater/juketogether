#!/usr/bin/env python3
"""
SoundCloud scraper for profiles and playlists
Scrapes tracks without requiring a client_id
"""
import sys
import json
import re
import urllib.parse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

def scrape_profile(url):
    """Scrape all tracks from a SoundCloud profile"""
    try:
        # Normalize URL - ensure it ends with /tracks for better results
        # Handle various profile URL formats:
        # - soundcloud.com/username
        # - soundcloud.com/username/
        # - soundcloud.com/username/tracks
        # - soundcloud.com/username/popular-tracks
        url = url.rstrip('/')
        
        # Check if URL already ends with a profile page indicator
        profile_pages = ['/tracks', '/popular-tracks', '/albums', '/sets', '/playlists', '/reposts']
        has_profile_page = any(url.endswith(page) for page in profile_pages)
        
        if not has_profile_page:
            # If it's just a username, append /tracks
            # Extract username from URL
            username_match = re.search(r'soundcloud\.com/([^/]+)/?$', url)
            if username_match:
                url = url + '/tracks'
            else:
                # If URL has path segments, assume it needs /tracks
                url = url + '/tracks'
        
        # Fetch the profile page
        req = Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        })
        
        with urlopen(req, timeout=30) as response:
            html = response.read().decode('utf-8', errors='ignore')
        
        tracks = []
        seen_urls = set()
        
        # Extract username from URL
        username_match = re.search(r'soundcloud\.com/([^/]+)', url)
        username = username_match.group(1) if username_match else None
        
        # Method 1: Find track links in href attributes
        # Pattern: href="/username/track-name" or href="https://soundcloud.com/username/track-name"
        track_patterns = [
            r'href="(https://soundcloud\.com/[^/]+/[^/"]+)"',  # Full URLs
            r'href="/([^/]+/[^/"]+)"',  # Relative URLs
        ]
        
        for pattern in track_patterns:
            matches = re.findall(pattern, html)
            for match in matches:
                # Build full URL if it's relative
                if not match.startswith('http'):
                    track_url = f"https://soundcloud.com/{match}"
                else:
                    track_url = match
                
                # Skip if it's a playlist, set, or other non-track URL
                if '/sets/' in track_url or '/playlists/' in track_url or '/reposts' in track_url:
                    continue
                
                # Check if it's a track (username/track-name format)
                url_parts = track_url.replace('https://soundcloud.com/', '').split('/')
                if len(url_parts) == 2 and url_parts[0] and url_parts[1]:
                    # It's a track URL
                    if track_url not in seen_urls:
                        seen_urls.add(track_url)
                        track_name = url_parts[1]
                        # Clean up track name for display
                        display_name = track_name.replace('-', ' ').replace('_', ' ').title()
                        
                        tracks.append({
                            'url': track_url,
                            'title': display_name,
                            'artist': username.replace('-', ' ').title() if username else None,
                            'fullTitle': f"{username.replace('-', ' ').title()} - {display_name}" if username else display_name,
                            'thumbnail': None
                        })
        
        # Method 2: Extract track information from sound list items (most reliable)
        # Look for sound list items with aria-label containing track info
        # Pattern: <li class="soundList__item">...aria-label="Track: track-name by Artist"
        sound_item_pattern = r'<li[^>]*class="soundList__item"[^>]*>.*?aria-label="Track:\s*([^"]+)\s+by\s+([^"]+)"'
        sound_items = re.findall(sound_item_pattern, html, re.DOTALL)
        
        for track_name, artist_name in sound_items:
            # Find the corresponding href link for this track
            # Look for href="/username/track-slug" pattern
            # The track slug is usually derived from the track name
            track_name_clean = track_name.strip()
            
            # Try to find the href link near this aria-label
            # Search in a window around where we found the aria-label
            aria_pos = html.find(f'aria-label="Track: {track_name}')
            if aria_pos != -1:
                # Look in a 2000 character window around the aria-label
                context_start = max(0, aria_pos - 1000)
                context_end = min(len(html), aria_pos + 1000)
                context = html[context_start:context_end]
                
                # Find href="/username/track-slug" in this context
                href_pattern = r'href="/([^/]+)/([^/"]+)"'
                href_matches = re.findall(href_pattern, context)
                
                for artist_slug, track_slug in href_matches:
                    # Skip if it's a playlist or other non-track URL
                    if '/sets/' in track_slug or '/playlists/' in track_slug or track_slug in ['tracks', 'albums', 'sets', 'reposts', 'followers', 'following']:
                        continue
                    
                    track_url = f"https://soundcloud.com/{artist_slug}/{track_slug}"
                    
                    if track_url not in seen_urls:
                        seen_urls.add(track_url)
                        # Check if we already have this track
                        existing = next((t for t in tracks if t['url'] == track_url), None)
                        if not existing:
                            tracks.append({
                                'url': track_url,
                                'title': track_name_clean,
                                'artist': artist_name.strip(),
                                'fullTitle': f"{artist_name.strip()} - {track_name_clean}",
                                'thumbnail': None
                            })
                        break  # Found the track URL, move to next track
        
        # Method 3: Extract from sound__coverArt links (direct approach)
        # Pattern: <a class="sound__coverArt" href="/username/track-slug">
        cover_art_pattern = r'<a[^>]*class="[^"]*sound__coverArt[^"]*"[^>]*href="/([^/]+)/([^/"]+)"'
        cover_art_matches = re.findall(cover_art_pattern, html)
        
        for artist_slug, track_slug in cover_art_matches:
            # Skip if it's a playlist or other non-track URL
            if '/sets/' in track_slug or '/playlists/' in track_slug or track_slug in ['tracks', 'albums', 'sets', 'reposts', 'followers', 'following']:
                continue
            
            track_url = f"https://soundcloud.com/{artist_slug}/{track_slug}"
            
            if track_url not in seen_urls:
                seen_urls.add(track_url)
                # Try to find the track name from aria-label or title
                track_name = track_slug.replace('-', ' ').replace('_', ' ').title()
                artist_name = artist_slug.replace('-', ' ').title()
                
                # Check if we already have this track
                existing = next((t for t in tracks if t['url'] == track_url), None)
                if not existing:
                    tracks.append({
                        'url': track_url,
                        'title': track_name,
                        'artist': artist_name,
                        'fullTitle': f"{artist_name} - {track_name}",
                        'thumbnail': None
                    })
        
        # Remove duplicates based on URL
        unique_tracks = []
        seen = set()
        for track in tracks:
            if track['url'] not in seen:
                seen.add(track['url'])
                unique_tracks.append(track)
        
        return unique_tracks if unique_tracks else {'error': 'No tracks found'}
        
    except Exception as e:
        return {'error': str(e)}

def extract_tracks_from_hydration(data):
    """Extract tracks from SoundCloud hydration data"""
    tracks = []
    
    def search_dict(obj, depth=0):
        if depth > 10:  # Prevent infinite recursion
            return
        
        if isinstance(obj, dict):
            # Look for track-like objects
            if 'permalink_url' in obj or 'uri' in obj:
                url = obj.get('permalink_url') or obj.get('uri', '')
                if url and 'soundcloud.com' in url and '/sets/' not in url and '/playlists/' not in url:
                    title = obj.get('title', 'Unknown Track')
                    user = obj.get('user', {})
                    artist = user.get('username', '') if user else None
                    
                    tracks.append({
                        'url': url,
                        'title': title,
                        'artist': artist,
                        'fullTitle': f"{artist} - {title}" if artist else title,
                        'thumbnail': obj.get('artwork_url') or (user.get('avatar_url') if user else None)
                    })
            
            # Recursively search nested objects
            for value in obj.values():
                search_dict(value, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                search_dict(item, depth + 1)
    
    search_dict(data)
    return tracks

def scrape_playlist(url):
    """Scrape all tracks from a SoundCloud playlist"""
    try:
        # Fetch the playlist page
        req = Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        })
        
        with urlopen(req, timeout=30) as response:
            html = response.read().decode('utf-8', errors='ignore')
        
        tracks = []
        seen_urls = set()
        
        # Extract playlist owner from URL
        owner_match = re.search(r'soundcloud\.com/([^/]+)', url)
        owner = owner_match.group(1) if owner_match else None
        
        # Method 0: Extract tracks from track station pages (systemPlaylistTrackList)
        # Track stations have a specific structure with systemPlaylistTrackList__item
        # Also works for regular playlists that use trackItem__trackTitle
        track_station_pattern = r'<a[^>]*class="[^"]*trackItem__trackTitle[^"]*"[^>]*href="/([^/]+/[^?"#]+)'
        track_station_matches = re.findall(track_station_pattern, html)
        for match in track_station_matches:
            # Remove query parameters
            clean_match = match.split('?')[0]
            track_url = f"https://soundcloud.com/{clean_match}"
            if track_url not in seen_urls and '/sets/' not in track_url and '/playlists/' not in track_url:
                seen_urls.add(track_url)
                url_parts = clean_match.split('/')
                if len(url_parts) == 2 and url_parts[0] and url_parts[1]:
                    track_name = url_parts[1]
                    display_name = track_name.replace('-', ' ').replace('_', ' ').title()
                    artist_name = url_parts[0].replace('-', ' ').title()
                    tracks.append({
                        'url': track_url,
                        'title': display_name,
                        'artist': artist_name,
                        'fullTitle': f"{artist_name} - {display_name}",
                        'thumbnail': None
                    })
        
        # Method 1: Extract track information from sound list items (best method)
        # Look for sound list items with aria-label containing track info
        sound_item_pattern = r'<li[^>]*class="soundList__item"[^>]*>.*?aria-label="Track:\s*([^"]+)\s+by\s+([^"]+)"[^>]*>.*?</li>'
        sound_items = re.findall(sound_item_pattern, html, re.DOTALL)
        
        for track_name, artist_name in sound_items:
            # Find the href within this sound item
            track_name_slug = track_name.lower().replace(' ', '-').replace('(', '').replace(')', '').replace('.', '').replace('mp3', '')
            # Try to find href with this track
            href_pattern = rf'href="/([^/]+)/([^"]*{re.escape(track_name_slug[:30])}[^"]*)"'
            href_match = re.search(href_pattern, html, re.IGNORECASE)
            if href_match:
                artist_slug = href_match.group(1)
                track_slug = href_match.group(2)
                track_url = f"https://soundcloud.com/{artist_slug}/{track_slug}"
                
                if track_url not in seen_urls and '/sets/' not in track_url and '/playlists/' not in track_url:
                    seen_urls.add(track_url)
                    tracks.append({
                        'url': track_url,
                        'title': track_name.strip(),
                        'artist': artist_name.strip(),
                        'fullTitle': f"{artist_name.strip()} - {track_name.strip()}",
                        'thumbnail': None
                    })
        
        # Method 2: Find track links in href attributes (fallback)
        track_patterns = [
            r'href="(https://soundcloud\.com/[^/]+/[^/"]+)"',  # Full URLs
            r'href="/([^/]+/[^/"]+)"',  # Relative URLs
        ]
        
        for pattern in track_patterns:
            matches = re.findall(pattern, html)
            for match in matches:
                # Build full URL if it's relative
                if not match.startswith('http'):
                    # Remove query parameters from relative URLs (e.g., ?in_system_playlist=...)
                    clean_match = match.split('?')[0]
                    track_url = f"https://soundcloud.com/{clean_match}"
                else:
                    # Remove query parameters from full URLs
                    track_url = match.split('?')[0]
                
                # Skip if it's a playlist, set, or other non-track URL
                if '/sets/' in track_url or '/playlists/' in track_url:
                    continue
                
                # Check if it's a track (username/track-name format)
                url_parts = track_url.replace('https://soundcloud.com/', '').split('/')
                if len(url_parts) == 2 and url_parts[0] and url_parts[1]:
                    if track_url not in seen_urls:
                        seen_urls.add(track_url)
                        track_name = url_parts[1]
                        display_name = track_name.replace('-', ' ').replace('_', ' ').title()
                        artist_name = url_parts[0].replace('-', ' ').title()
                        
                        tracks.append({
                            'url': track_url,
                            'title': display_name,
                            'artist': artist_name,
                            'fullTitle': f"{artist_name} - {display_name}",
                            'thumbnail': None
                        })
        
        # Remove duplicates
        unique_tracks = []
        seen = set()
        for track in tracks:
            if track['url'] not in seen:
                seen.add(track['url'])
                unique_tracks.append(track)
        
        return unique_tracks if unique_tracks else {'error': 'No tracks found'}
        
    except Exception as e:
        return {'error': str(e)}

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Usage: python scrape_soundcloud.py <type> <url>'}))
        sys.exit(1)
    
    scrape_type = sys.argv[1]
    url = sys.argv[2]
    
    if scrape_type == 'profile':
        result = scrape_profile(url)
    elif scrape_type == 'playlist':
        result = scrape_playlist(url)
    else:
        result = {'error': f'Unknown type: {scrape_type}'}
    
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()

