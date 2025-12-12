import { useState, useEffect } from 'react';
import { supabase } from '../SupaBase.js';
import { useAuth } from '../auth/useAuth.js';
import { useNavigate } from 'react-router-dom';
import '../css/RedeemPage.css';
import GlobalReforestation from '../assets/global_reforestation.png';
import OceanConservation from '../assets/ocean_conservation.png';
import RenewableEnergy from '../assets/renewable_energy.png';
import WildlifeProtection from '../assets/wildlife_protection.png';

// Map charity names to their images (must match database names exactly)
const charityImages = {
    'Global Reforestation Project': GlobalReforestation,
    'Ocean Conservation Fund': OceanConservation,
    'Renewable Energy Initiative': RenewableEnergy,
    'Wildlife Protection Alliance': WildlifeProtection,
};

const RedeemPage = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [userPoints, setUserPoints] = useState(0);
    const [totalEarned, setTotalEarned] = useState(0);
    const [totalDonated, setTotalDonated] = useState(0);
    const [userId, setUserId] = useState(null);
    const [charities, setCharities] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Selected donation amount
    const [selectedAmount, setSelectedAmount] = useState(100);
    const donationAmounts = [50, 100, 200, 500];
    
    // Donation in progress
    const [donating, setDonating] = useState(false);

    // Handle logout
    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    // Fetch user details
    useEffect(() => {
        const fetchUserDetails = async () => {
            if (!user) return;
            
            const { data, error } = await supabase
                .from('user_details')
                .select('user_id, points, total_points_earned, total_points_donated')
                .eq('auth_id', user.id)
                .single();
            
            if (!error && data) {
                setUserPoints(data.points || 0);
                setTotalEarned(data.total_points_earned || 0);
                setTotalDonated(data.total_points_donated || 0);
                setUserId(data.user_id);
            }
        };

        fetchUserDetails();
    }, [user]);

    // Fetch charities
    useEffect(() => {
        const fetchCharities = async () => {
            setLoading(true);
            
            const { data, error } = await supabase
                .from('charities')
                .select('*')
                .order('id', { ascending: true });
            
            if (!error) {
                setCharities(data || []);
            }
            setLoading(false);
        };

        fetchCharities();
    }, []);

    // Handle donation
    const handleDonate = async (charity) => {
        if (!userId) {
            alert('Please log in to donate!');
            return;
        }

        if (userPoints < selectedAmount) {
            alert('Insufficient points!');
            return;
        }

        if (selectedAmount < charity.min_donation) {
            alert(`Minimum donation for ${charity.name} is ${charity.min_donation} points`);
            return;
        }

        setDonating(true);

        try {
            // Create donation record
            const { error: donationError } = await supabase
                .from('donations')
                .insert({
                    user_id: userId,
                    charity_id: charity.id,
                    points_donated: selectedAmount
                });

            if (donationError) {
                console.error('Donation error:', donationError);
                alert('Failed to process donation. Please try again.');
                setDonating(false);
                return;
            }

            // Update user points
            const newPoints = userPoints - selectedAmount;
            const newTotalDonated = totalDonated + selectedAmount;

            const { error: updateError } = await supabase
                .from('user_details')
                .update({
                    points: newPoints,
                    total_points_donated: newTotalDonated
                })
                .eq('user_id', userId);

            if (updateError) {
                console.error('Update error:', updateError);
                alert('Failed to update points. Please try again.');
                setDonating(false);
                return;
            }

            // Update local state
            setUserPoints(newPoints);
            setTotalDonated(newTotalDonated);

            alert(`Thank you for donating ${selectedAmount} points to ${charity.name}! 🌱`);
        } catch (err) {
            console.error('Unexpected error:', err);
            alert('An unexpected error occurred.');
        }

        setDonating(false);
    };

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

    // Get charity gradient based on index
    const getCharityGradient = (index) => {
        const gradients = [
            'linear-gradient(135deg, #93c5fd 0%, #c4b5fd 100%)',
            'linear-gradient(135deg, #86efac 0%, #6ee7b7 100%)',
            'linear-gradient(135deg, #fcd34d 0%, #fbbf24 100%)',
            'linear-gradient(135deg, #f9a8d4 0%, #f472b6 100%)'
        ];
        return gradients[index % gradients.length];
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
                        className={`nav-tab ${tab.id === 'redeem' ? 'active' : ''}`}
                        onClick={() => navigate(tab.path)}
                    >
                        {renderTabIcon(tab.icon)}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            {/* Main Content */}
            <main className="main-content">
                <div className="redeem-section">
                    <div className="section-header">
                        <div className="section-icon redeem-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                                <rect x="3" y="8" width="18" height="4" rx="1" />
                                <path d="M12 8v13" />
                                <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
                                <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="section-title">Redeem Points</h1>
                            <p className="section-subtitle">Use your points to support environmental causes</p>
                        </div>
                    </div>

                    {/* Points Card */}
                    <div className="points-card">
                        <div className="points-card-label">Available Points</div>
                        <div className="points-card-value">{userPoints}</div>
                        <div className="points-card-stats">
                            Total earned: {totalEarned} | Donated: {totalDonated}
                        </div>
                    </div>

                    {/* Donation Amount Selector */}
                    <div className="donation-amount-section">
                        <h3 className="donation-section-title">Select Donation Amount</h3>
                        <div className="amount-buttons">
                            {donationAmounts.map(amount => (
                                <button
                                    key={amount}
                                    className={`amount-btn ${selectedAmount === amount ? 'selected' : ''}`}
                                    onClick={() => setSelectedAmount(amount)}
                                >
                                    {amount} points
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Charities */}
                    <div className="charities-section">
                        <h3 className="donation-section-title">Choose a Charity</h3>
                        
                        {loading ? (
                            <div className="loading-state">
                                <p>Loading charities...</p>
                            </div>
                        ) : (
                            <div className="charities-grid">
                                {charities.map((charity, index) => {
                                    const canDonate = userPoints >= selectedAmount && selectedAmount >= charity.min_donation;
                                    const insufficientPoints = userPoints < selectedAmount;
                                    const belowMinimum = selectedAmount < charity.min_donation;
                                    
                                    return (
                                        <div key={charity.id} className="charity-card">
                                            <div className="charity-image-container">
                                                <img 
                                                    src={charityImages[charity.name] || GlobalReforestation} 
                                                    alt={charity.name}
                                                    className="charity-image"
                                                />
                                            </div>
                                            <div className="charity-info">
                                                <h4 className="charity-name">{charity.name}</h4>
                                                <p className="charity-description">{charity.description}</p>
                                                <p className="charity-minimum">Minimum donation: {charity.min_donation} points</p>
                                            </div>
                                            <button
                                                className={`donate-btn ${canDonate ? 'can-donate' : 'cannot-donate'}`}
                                                onClick={() => handleDonate(charity)}
                                                disabled={!canDonate || donating}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                                </svg>
                                                {donating ? 'Donating...' : 
                                                 insufficientPoints ? 'Insufficient Points' : 
                                                 belowMinimum ? `Min ${charity.min_donation} pts` :
                                                 `Donate ${selectedAmount} pts`}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default RedeemPage;
