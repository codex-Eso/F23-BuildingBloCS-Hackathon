import { useState, useEffect } from 'react';
import { supabase } from '../SupaBase.js';
import { useAuth } from '../auth/useAuth.js';
import { useNavigate } from 'react-router-dom';
import '../css/CommunityPage.css';

const CommunityPage = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [userPoints, setUserPoints] = useState(0);
    const [communityPosts, setCommunityPosts] = useState([]);
    const [communityLoading, setCommunityLoading] = useState(true);

    // Handle logout
    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    // Fetch user points
    useEffect(() => {
        const fetchUserPoints = async () => {
            if (!user) return;
            
            const { data, error } = await supabase
                .from('user_details')
                .select('points')
                .eq('auth_id', user.id)
                .single();
            
            if (!error && data) {
                setUserPoints(data.points || 0);
            }
        };

        fetchUserPoints();
    }, [user]);

    // Fetch community posts
    useEffect(() => {
        const fetchCommunityPosts = async () => {
            setCommunityLoading(true);
            
            try {
                const { data, error: fetchError } = await supabase
                    .from('community_page')
                    .select(`
                        *,
                        user_details (name, username),
                        quests (title, points)
                    `)
                    .order('created_at', { ascending: false });
                
                if (fetchError) {
                    console.error('Error fetching community posts:', fetchError);
                } else {
                    setCommunityPosts(data || []);
                }
            } catch (err) {
                console.error('Unexpected error fetching posts:', err);
            }
            setCommunityLoading(false);
        };

        fetchCommunityPosts();
    }, []);

    const tabs = [
        { id: 'quests', label: 'Quests', icon: 'trophy', path: '/Homepage' },
        { id: 'community', label: 'Community', icon: 'people', path: '/community' },
        { id: 'redeem', label: 'Redeem', icon: 'gift', path: '/redeem' },
        { id: 'profile', label: 'Profile', icon: 'person', path: '/profile' }
    ];

    const renderTabIcon = (iconType) => {
        switch (iconType) {
            case 'trophy':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                        <path d="M4 22h16" />
                        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                );
            case 'people':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                );
            case 'gift':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="8" width="18" height="4" rx="1" />
                        <path d="M12 8v13" />
                        <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
                        <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
                    </svg>
                );
            case 'person':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="8" r="5" />
                        <path d="M20 21a8 8 0 0 0-16 0" />
                    </svg>
                );
            default:
                return null;
        }
    };

    return (
        <div className="ecoquest-container">
            {/* Header */}
            <header className="ecoquest-header">
                <div className="logo">
                    <div className="logo-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.5 0 3-.3 4.3-.9" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M17 8c-4 0-6 3-6 6s3 6 6 6 6-3 6-6" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M20 5l-3 3" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </div>
                    <span className="logo-text">EcoQuest</span>
                </div>
                <div className="header-right">
                    <div className="points-badge">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                            <path d="M4 22h16" />
                            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                        </svg>
                        <span>{userPoints} pts</span>
                    </div>
                    <div className="profile-avatar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>Logout</span>
                    </button>
                </div>
            </header>

            {/* Navigation Tabs */}
            <nav className="nav-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`nav-tab ${tab.id === 'community' ? 'active' : ''}`}
                        onClick={() => navigate(tab.path)}
                    >
                        {renderTabIcon(tab.icon)}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            {/* Main Content */}
            <main className="main-content">
                <div className="community-section">
                    <div className="section-header">
                        <div className="section-icon community-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="section-title">Community Feed</h1>
                            <p className="section-subtitle">See what other eco-warriors are accomplishing!</p>
                        </div>
                    </div>

                    {communityLoading ? (
                        <div className="loading-state">
                            <p>Loading posts...</p>
                        </div>
                    ) : communityPosts.length === 0 ? (
                        <div className="community-empty-state">
                            <div className="empty-icon">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <h3>No posts yet</h3>
                            <p>Complete a photo quest to be the first to share with the community!</p>
                        </div>
                    ) : (
                        <div className="community-posts">
                            {communityPosts.map(post => (
                                <div key={post.post_id} className="community-post-card">
                                    <div className="post-header">
                                        <div className="post-avatar">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                        </div>
                                        <div className="post-user-info">
                                            <span className="post-username">{post.user_details?.name || 'Anonymous'}</span>
                                            <span className="post-date">{new Date(post.created_at).toLocaleDateString()}</span>
                                        </div>
                                        {post.quests && (
                                            <div className="post-quest-badge">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                                                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                                                </svg>
                                                <span>+{post.quests.points} pts</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="post-content">
                                        <h4 className="post-title">{post.post_title}</h4>
                                        {post.post_caption && (
                                            <p className="post-caption">{post.post_caption}</p>
                                        )}
                                        {post.image_url && (
                                            <div className="post-image-container">
                                                <img 
                                                    src={post.image_url} 
                                                    alt="Quest completion proof" 
                                                    className="post-image"
                                                />
                                            </div>
                                        )}
                                        {post.quests && (
                                            <div className="post-quest-info">
                                                <span className="quest-completed-label">Quest completed:</span>
                                                <span className="quest-completed-name">{post.quests.title}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="post-actions">
                                        <button className="like-btn">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                            </svg>
                                            <span>{post.number_of_likes || 0}</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default CommunityPage;
