import { useState, useEffect } from 'react';
import { supabase } from '../SupaBase.js';
import { useAuth } from '../auth/useAuth.js';
import { useNavigate } from 'react-router-dom';
import '../css/HomePage.css';

const HomePage = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [userPoints, setUserPoints] = useState(0);
    const [userId, setUserId] = useState(null);
    const [quests, setQuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Track user's quest submissions
    const [userSubmissions, setUserSubmissions] = useState([]);
    
    // Modal state for quest completion
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [selectedQuest, setSelectedQuest] = useState(null);
    const [postTitle, setPostTitle] = useState('');
    const [postCaption, setPostCaption] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    // Image upload state
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    // Handle logout
    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    // Fetch user details (points and user_id)
    useEffect(() => {
        const fetchUserDetails = async () => {
            if (!user) return;
            
            const { data, error } = await supabase
                .from('user_details')
                .select('user_id, points')
                .eq('auth_id', user.id)
                .single();
            
            if (error) {
                console.error('Error fetching user details:', error);
            } else if (data) {
                setUserPoints(data.points || 0);
                setUserId(data.user_id);
                
                // Fetch user's quest submissions
                const { data: submissions, error: subError } = await supabase
                    .from('quest_submissions')
                    .select('quest_id, status')
                    .eq('user_id', data.user_id);
                
                if (subError) {
                    console.error('Error fetching submissions:', subError);
                } else {
                    setUserSubmissions(submissions || []);
                }
            }
        };

        fetchUserDetails();
    }, [user]);

    // Fetch quests from Supabase
    useEffect(() => {
        const fetchQuests = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const { data, error: fetchError } = await supabase
                    .from('quests')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                console.log('Quests fetch result:', { data, error: fetchError });
                
                if (fetchError) {
                    console.error('Error fetching quests:', fetchError);
                    setError('Failed to load quests: ' + fetchError.message);
                } else {
                    // Map the quests with icon type based on title/description
                    const mappedQuests = (data || []).map(quest => ({
                        ...quest,
                        icon: quest.title?.toLowerCase().includes('quiz') ? 'quiz' : 'photo',
                        type: quest.title?.toLowerCase().includes('quiz') ? 'Quiz' : 'Photo Challenge'
                    }));
                    console.log('Mapped quests:', mappedQuests);
                    setQuests(mappedQuests);
                }
            } catch (err) {
                console.error('Unexpected error:', err);
                setError('An unexpected error occurred');
            }
            setLoading(false);
        };

        fetchQuests();
    }, []);

    // Handle quest completion
    const handleStartQuest = (quest) => {
        if (!user) {
            alert('Please log in to complete quests!');
            return;
        }
        setSelectedQuest(quest);
        setPostTitle(`Completed: ${quest.title}`);
        setPostCaption('');
        setSelectedImage(null);
        setImagePreview(null);
        setShowCompletionModal(true);
    };

    // Handle image selection
    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('Image must be less than 5MB');
                return;
            }
            setSelectedImage(file);
            // Create preview URL
            const previewUrl = URL.createObjectURL(file);
            setImagePreview(previewUrl);
        }
    };

    // Remove selected image
    const handleRemoveImage = () => {
        setSelectedImage(null);
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }
        setImagePreview(null);
    };

    // Submit quest completion with community post
    const handleSubmitCompletion = async () => {
        if (!selectedQuest || !userId) return;
        
        setSubmitting(true);
        
        try {
            let imageUrl = null;
            
            // Upload image if selected
            if (selectedImage) {
                const fileExt = selectedImage.name.split('.').pop();
                const fileName = `${user.id}/${Date.now()}.${fileExt}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('quest-images')
                    .upload(fileName, selectedImage);
                
                if (uploadError) {
                    console.error('Error uploading image:', uploadError);
                    alert('Failed to upload image. Please try again.');
                    setSubmitting(false);
                    return;
                }
                
                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('quest-images')
                    .getPublicUrl(fileName);
                
                imageUrl = urlData.publicUrl;
            }
            
            // Create pending submission for admin approval
            const { error: submissionError } = await supabase
                .from('quest_submissions')
                .insert({
                    user_id: userId,
                    quest_id: selectedQuest.id,
                    post_title: postTitle,
                    post_caption: postCaption || null,
                    image_url: imageUrl,
                    status: 'pending',
                    submitted_at: new Date().toISOString()
                });
            
            if (submissionError) {
                console.error('Error creating submission:', submissionError);
                alert('Failed to submit quest. Please try again.');
                setSubmitting(false);
                return;
            }
            
            // Update local state to reflect the pending submission
            setUserSubmissions(prev => [...prev, { quest_id: selectedQuest.id, status: 'pending' }]);
            
            // Close modal and reset
            setShowCompletionModal(false);
            setSelectedQuest(null);
            setPostTitle('');
            setPostCaption('');
            handleRemoveImage();
            
            // Show success message
            alert('Quest submitted for approval! You will earn points once an admin approves your submission.');
            
        } catch (err) {
            console.error('Unexpected error:', err);
            alert('An unexpected error occurred.');
        }
        
        setSubmitting(false);
    };

    const tabs = [
        { id: 'quests', label: 'Quests', icon: 'trophy', path: '/Homepage' },
        { id: 'community', label: 'Community', icon: 'people', path: '/community' },
        { id: 'redeem', label: 'Redeem', icon: 'gift', path: '/redeem' },
        { id: 'profile', label: 'Profile', icon: 'person', path: '/profile' }
    ];

    // Helper to get submission status for a quest
    const getQuestSubmissionStatus = (questId) => {
        const submission = userSubmissions.find(s => s.quest_id === questId);
        return submission?.status || null;
    };

    // Get button text and disabled state based on submission status
    const getQuestButtonState = (questId) => {
        const status = getQuestSubmissionStatus(questId);
        switch (status) {
            case 'pending':
                return { text: 'Pending Approval', disabled: true, className: 'pending' };
            case 'approved':
                return { text: 'Completed ✓', disabled: true, className: 'completed' };
            case 'rejected':
                return { text: 'Rejected - Try Again', disabled: false, className: 'rejected' };
            default:
                return { text: 'Start Quest', disabled: false, className: '' };
        }
    };

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

    const renderQuestIcon = (iconType) => {
        if (iconType === 'quiz') {
            return (
                <div className="quest-icon quiz-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                        <path d="M8 7h6" />
                        <path d="M8 11h8" />
                    </svg>
                </div>
            );
        }
        return (
            <div className="quest-icon photo-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                </svg>
            </div>
        );
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
                        className={`nav-tab ${tab.id === 'quests' ? 'active' : ''}`}
                        onClick={() => navigate(tab.path)}
                    >
                        {renderTabIcon(tab.icon)}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            {/* Main Content */}
            <main className="main-content">
                <div className="quests-section">
                        <div className="section-header">
                            <div className="section-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="#F59E0B">
                                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                                    <path d="M4 22h16" />
                                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="section-title">Weekly Quests</h1>
                                <p className="section-subtitle">Complete quests to earn points and make a difference!</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="loading-state">
                                <p>Loading quests...</p>
                            </div>
                        ) : error ? (
                            <div className="error-state">
                                <p>{error}</p>
                            </div>
                        ) : quests.length === 0 ? (
                            <div className="empty-state">
                                <p>No quests available at the moment. Check back later!</p>
                            </div>
                        ) : (
                            <div className="quests-grid">
                                {quests.map(quest => (
                                    <div key={quest.id} className="quest-card">
                                        <div className="quest-card-header">
                                            {renderQuestIcon(quest.icon)}
                                            <div className="quest-info">
                                                <h3 className="quest-title">{quest.title}</h3>
                                                <span className={`quest-type ${quest.type === 'Quiz' ? 'quiz' : 'photo'}`}>
                                                    {quest.type}
                                                </span>
                                            </div>
                                            <div className="quest-points">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                                                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                                                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                                                    <path d="M4 22h16" />
                                                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                                                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                                                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                                                </svg>
                                                <span>{quest.points}</span>
                                            </div>
                                        </div>
                                        <p className="quest-description">{quest.description}</p>
                                        {(() => {
                                            const buttonState = getQuestButtonState(quest.id);
                                            return (
                                                <button 
                                                    className={`start-quest-btn ${buttonState.className}`}
                                                    onClick={() => handleStartQuest(quest)}
                                                    disabled={buttonState.disabled}
                                                >
                                                    {buttonState.text}
                                                </button>
                                            );
                                        })()}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>


            </main>

            {/* Quest Completion Modal */}
            {showCompletionModal && selectedQuest && (
                <div className="modal-overlay" onClick={() => setShowCompletionModal(false)}>
                    <div className="completion-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Complete Quest</h2>
                            <button 
                                className="modal-close-btn"
                                onClick={() => setShowCompletionModal(false)}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="modal-quest-info">
                            <div className="modal-quest-title">{selectedQuest.title}</div>
                            <div className="modal-quest-points">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                                </svg>
                                <span>+{selectedQuest.points} points</span>
                            </div>
                        </div>
                        
                        <div className="modal-form">
                            <p className="modal-description">Share your accomplishment with the community!</p>
                            
                            <div className="form-group">
                                <label htmlFor="postTitle">Post Title</label>
                                <input
                                    id="postTitle"
                                    type="text"
                                    value={postTitle}
                                    onChange={(e) => setPostTitle(e.target.value)}
                                    placeholder="Enter a title for your post"
                                    maxLength={100}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="postCaption">Description (optional)</label>
                                <textarea
                                    id="postCaption"
                                    value={postCaption}
                                    onChange={(e) => setPostCaption(e.target.value)}
                                    placeholder="Tell us about your experience..."
                                    rows={4}
                                    maxLength={500}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label>Proof of Completion (Photo)</label>
                                {!imagePreview ? (
                                    <div className="image-upload-area">
                                        <input
                                            type="file"
                                            id="imageUpload"
                                            accept="image/*"
                                            onChange={handleImageSelect}
                                            className="hidden-input"
                                        />
                                        <label htmlFor="imageUpload" className="upload-label">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                                                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                                                <circle cx="12" cy="13" r="3" />
                                            </svg>
                                            <span>Click to upload photo</span>
                                            <span className="upload-hint">Max 5MB • JPG, PNG, GIF</span>
                                        </label>
                                    </div>
                                ) : (
                                    <div className="image-preview-container">
                                        <img src={imagePreview} alt="Preview" className="image-preview" />
                                        <button 
                                            type="button" 
                                            className="remove-image-btn"
                                            onClick={handleRemoveImage}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M18 6L6 18M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="modal-actions">
                            <button 
                                className="modal-cancel-btn"
                                onClick={() => setShowCompletionModal(false)}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button 
                                className="modal-submit-btn"
                                onClick={handleSubmitCompletion}
                                disabled={submitting || !postTitle.trim()}
                            >
                                {submitting ? 'Sharing...' : 'Complete & Share'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePage;