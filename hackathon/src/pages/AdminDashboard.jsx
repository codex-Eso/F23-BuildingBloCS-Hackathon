import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { supabase } from '../SupaBase.js'
import '../css/AdminDashboard.css'

export function AdminDashboard() {
  const navigate = useNavigate()
  const { user, signOut, isAdmin, loading: authLoading } = useAuth()

  const [users, setUsers] = useState([])
  const [quests, setQuests] = useState([])
  const [assignments, setAssignments] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Active tab
  const [activeTab, setActiveTab] = useState('submissions')

  // Create/Edit quest form
  const [questForm, setQuestForm] = useState({ id: null, title: '', description: '', points: 10 })
  const [isEditing, setIsEditing] = useState(false)

  // Assignment form
  const [selectedQuestId, setSelectedQuestId] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState([])

  const students = useMemo(() => users.filter((u) => u.role !== 'admin'), [users])

  // STRICT: Double-check role - student should NEVER see this
  useEffect(() => {
    if (authLoading) return
    if (!isAdmin) {
      navigate('/app', { replace: true })
    }
  }, [authLoading, isAdmin, navigate])

  // Load all data when admin is confirmed
  useEffect(() => {
    if (authLoading) return // Wait for auth
    if (!isAdmin) return // Not admin, will redirect
    
    // Immediately start loading data
    let cancelled = false
    
    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        const [usersResult, questsResult, assignmentsResult, submissionsResult] = await Promise.all([
          supabase.from('user_details').select('*').order('created_at', { ascending: false }),
          supabase.from('quests').select('*').order('created_at', { ascending: false }),
          supabase.from('quest_assignments').select('*, quests(id,title,points)').order('assigned_at', { ascending: false }),
          supabase.from('quest_submissions').select('*, user_details!quest_submissions_user_id_fkey(user_id, name, username), quests(id, title, points)').order('submitted_at', { ascending: false }),
        ])

        if (cancelled) return

        if (usersResult.error) console.error('Users error:', usersResult.error)
        if (questsResult.error) console.error('Quests error:', questsResult.error)
        if (assignmentsResult.error) console.error('Assignments error:', assignmentsResult.error)
        if (submissionsResult.error) console.error('Submissions error:', submissionsResult.error)
        
        // Debug: Log submissions data
        console.log('Submissions fetched:', submissionsResult.data)
        console.log('Submissions count:', submissionsResult.data?.length || 0)

        setUsers(usersResult.data || [])
        setQuests(questsResult.data || [])
        setAssignments(assignmentsResult.data || [])
        setSubmissions(submissionsResult.data || [])
      } catch (err) {
        console.error('Load error:', err)
        if (!cancelled) setError(err.message)
      }
      
      if (!cancelled) setLoading(false)
    }

    fetchData()
    
    return () => { cancelled = true }
  }, [authLoading, isAdmin])

  // Reload data helper
  async function reloadData() {
    const [usersResult, questsResult, assignmentsResult, submissionsResult] = await Promise.all([
      supabase.from('user_details').select('*').order('created_at', { ascending: false }),
      supabase.from('quests').select('*').order('created_at', { ascending: false }),
      supabase.from('quest_assignments').select('*, quests(id,title,points)').order('assigned_at', { ascending: false }),
      supabase.from('quest_submissions').select('*, user_details!quest_submissions_user_id_fkey(user_id, name, username), quests(id, title, points)').order('submitted_at', { ascending: false }),
    ])
    setUsers(usersResult.data || [])
    setQuests(questsResult.data || [])
    setAssignments(assignmentsResult.data || [])
    setSubmissions(submissionsResult.data || [])
  }

  // Clear messages after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  // ============ QUEST CRUD ============

  async function handleQuestSubmit(e) {
    e.preventDefault()
    setError(null)

    if (isEditing && questForm.id) {
      // UPDATE
      const { error: updateErr } = await supabase
        .from('quests')
        .update({
          title: questForm.title.trim(),
          description: questForm.description.trim(),
          points: Number(questForm.points),
        })
        .eq('id', questForm.id)

      if (updateErr) {
        setError(updateErr.message)
        return
      }

      setQuests((prev) =>
        prev.map((q) =>
          q.id === questForm.id
            ? { ...q, title: questForm.title.trim(), description: questForm.description.trim(), points: Number(questForm.points) }
            : q
        )
      )
      setSuccess('Quest updated!')
    } else {
      // CREATE - get admin's user_id
      const adminUser = users.find((u) => u.auth_id === user?.id)
      
      const { data, error: insErr } = await supabase
        .from('quests')
        .insert([
          {
            title: questForm.title.trim(),
            description: questForm.description.trim(),
            points: Number(questForm.points),
            created_by: adminUser?.user_id || null,
          },
        ])
        .select('*')
        .single()

      if (insErr) {
        setError(insErr.message)
        return
      }

      setQuests((prev) => [data, ...prev])
      setSuccess('Quest created!')
    }

    resetQuestForm()
  }

  function editQuest(quest) {
    setQuestForm({ id: quest.id, title: quest.title, description: quest.description || '', points: quest.points })
    setIsEditing(true)
    setActiveTab('quests')
  }

  async function deleteQuest(questId) {
    if (!confirm('Are you sure you want to delete this quest? This will also delete all assignments.')) return

    setError(null)
    const { error: delErr } = await supabase.from('quests').delete().eq('id', questId)

    if (delErr) {
      setError(delErr.message)
      return
    }

    setQuests((prev) => prev.filter((q) => q.id !== questId))
    setAssignments((prev) => prev.filter((a) => a.quest_id !== questId))
    setSuccess('Quest deleted!')
  }

  function resetQuestForm() {
    setQuestForm({ id: null, title: '', description: '', points: 10 })
    setIsEditing(false)
  }

  // ============ QUEST ASSIGNMENT ============

  async function assignQuest(e) {
    e.preventDefault()
    setError(null)

    if (!selectedQuestId || selectedUserIds.length === 0) {
      setError('Select a quest and at least one student.')
      return
    }

    // Get the admin's user_id from user_details
    const adminUser = users.find((u) => u.auth_id === user?.id)

    const insertData = selectedUserIds.map((userId) => ({
      quest_id: Number(selectedQuestId),
      user_id: userId, // Now using bigint user_id
      assigned_by: adminUser?.user_id || null,
      status: 'assigned',
    }))

    const { data, error: insErr } = await supabase.from('quest_assignments').insert(insertData).select('*')

    if (insErr) {
      setError(insErr.message)
      return
    }

    // Reload to get full data with joins
    await reloadData()
    setSelectedQuestId('')
    setSelectedUserIds([])
    setSuccess(`Quest assigned to ${selectedUserIds.length} student(s)!`)
  }

  function toggleUserSelection(userId) {
    setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  function selectAllStudents() {
    if (selectedUserIds.length === students.length) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(students.map((s) => s.user_id)) // Use user_id (bigint)
    }
  }

  // ============ ASSIGNMENT MANAGEMENT ============

  async function updateAssignmentStatus(assignmentId, newStatus) {
    setError(null)

    const updates = { status: newStatus }
    if (newStatus === 'approved') {
      updates.completed_at = new Date().toISOString()
    }

    const { error: upErr } = await supabase.from('quest_assignments').update(updates).eq('id', assignmentId)

    if (upErr) {
      setError(upErr.message)
      return
    }

    setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? { ...a, ...updates } : a)))

    // If approved, update user's points - fetch fresh data to avoid stale values
    if (newStatus === 'approved') {
      const assignment = assignments.find((a) => a.id === assignmentId)
      if (assignment?.quests?.points && assignment?.user_id) {
        const { data: freshUserData } = await supabase
          .from('user_details')
          .select('user_id, points, total_points_earned, quest_completed')
          .eq('user_id', assignment.user_id)
          .single()

        if (freshUserData) {
          await supabase
            .from('user_details')
            .update({
              points: (freshUserData.points || 0) + assignment.quests.points,
              total_points_earned: (freshUserData.total_points_earned || 0) + assignment.quests.points,
              quest_completed: (freshUserData.quest_completed || 0) + 1,
            })
            .eq('user_id', freshUserData.user_id)
        }
      }
      setSuccess('Quest approved and points awarded!')
    } else {
      setSuccess(`Assignment ${newStatus}!`)
    }
  }

  async function deleteAssignment(assignmentId) {
    if (!confirm('Delete this assignment?')) return

    const { error: delErr } = await supabase.from('quest_assignments').delete().eq('id', assignmentId)

    if (delErr) {
      setError(delErr.message)
      return
    }

    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
    setSuccess('Assignment deleted!')
  }

  // ============ SUBMISSION APPROVAL ============

  async function approveSubmission(submission) {
    setError(null)

    const adminUser = users.find((u) => u.auth_id === user?.id)

    // Update submission status
    const { error: updateErr } = await supabase
      .from('quest_submissions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser?.user_id || null,
      })
      .eq('id', submission.id)

    if (updateErr) {
      setError(updateErr.message)
      return
    }

    // Create community post from the submission
    const { error: postError } = await supabase
      .from('community_page')
      .insert({
        user_id: submission.user_id,
        quest_id: submission.quest_id,
        post_title: submission.post_title,
        post_caption: submission.post_caption,
        image_url: submission.image_url,
        number_of_likes: 0,
        created_at: new Date().toISOString()
      })

    if (postError) {
      console.error('Error creating community post:', postError)
      setError('Submission approved but failed to create community post: ' + postError.message)
    }

    // Update user's points - fetch fresh data to avoid stale values
    if (submission.quests?.points) {
      const { data: freshUserData, error: fetchErr } = await supabase
        .from('user_details')
        .select('user_id, points, total_points_earned, quest_completed')
        .eq('user_id', submission.user_id)
        .single()

      if (fetchErr) {
        console.error('Error fetching user data for points update:', fetchErr)
        setError('Approved but failed to fetch user data: ' + fetchErr.message)
        return
      }

      if (freshUserData) {
        const { error: pointsErr } = await supabase
          .from('user_details')
          .update({
            points: (freshUserData.points || 0) + submission.quests.points,
            total_points_earned: (freshUserData.total_points_earned || 0) + submission.quests.points,
            quest_completed: (freshUserData.quest_completed || 0) + 1,
          })
          .eq('user_id', freshUserData.user_id)

        if (pointsErr) {
          console.error('Error updating user points:', pointsErr)
          setError('Approved but failed to award points: ' + pointsErr.message)
          return
        }
      }
    }

    // Update local state
    setSubmissions((prev) =>
      prev.map((s) => (s.id === submission.id ? { ...s, status: 'approved' } : s))
    )
    setSuccess('Submission approved! Points awarded and post created.')
  }

  async function rejectSubmission(submissionId, reason = '') {
    setError(null)

    const adminUser = users.find((u) => u.auth_id === user?.id)

    const { error: updateErr } = await supabase
      .from('quest_submissions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser?.user_id || null,
        rejection_reason: reason || 'Submission did not meet requirements',
      })
      .eq('id', submissionId)

    if (updateErr) {
      setError(updateErr.message)
      return
    }

    setSubmissions((prev) =>
      prev.map((s) => (s.id === submissionId ? { ...s, status: 'rejected' } : s))
    )
    setSuccess('Submission rejected.')
  }

  // ============ RENDER ============

  // Tab icon renderer
  const renderTabIcon = (tab) => {
    const icons = {
      submissions: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
      quests: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ),
      assign: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="8.5" cy="7" r="4"/>
          <line x1="20" y1="8" x2="20" y2="14"/>
          <line x1="23" y1="11" x2="17" y2="11"/>
        </svg>
      ),
      assignments: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
      students: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    }
    return icons[tab] || null
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-left">
          <div className="admin-logo">
            <svg width="40" height="40" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="45" fill="#22c55e"/>
              <path d="M30 50 L45 65 L70 35" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <div className="admin-logo-text">
              <h1>EcoQuest Admin</h1>
              <span className="admin-subtitle">Manage quests, users & submissions</span>
            </div>
          </div>
        </div>
        <div className="admin-header-right">
          <span className="admin-user-email">{user?.email}</span>
          <button onClick={signOut} className="admin-signout-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </header>

      {/* Messages */}
      {error && <div className="admin-message admin-message-error">{error}</div>}
      {success && <div className="admin-message admin-message-success">{success}</div>}

      {/* Stats Overview */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="stat-icon stat-icon-pending">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{submissions.filter(s => s.status === 'pending').length}</span>
            <span className="stat-label">Pending Reviews</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon stat-icon-quests">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{quests.length}</span>
            <span className="stat-label">Total Quests</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon stat-icon-students">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{students.length}</span>
            <span className="stat-label">Students</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon stat-icon-assignments">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{assignments.length}</span>
            <span className="stat-label">Assignments</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav className="admin-tabs">
        <button 
          className={`admin-tab ${activeTab === 'submissions' ? 'active' : ''}`} 
          onClick={() => setActiveTab('submissions')}
        >
          {renderTabIcon('submissions')}
          <span>Submissions</span>
          {submissions.filter(s => s.status === 'pending').length > 0 && (
            <span className="tab-badge">{submissions.filter(s => s.status === 'pending').length}</span>
          )}
        </button>
        <button 
          className={`admin-tab ${activeTab === 'quests' ? 'active' : ''}`} 
          onClick={() => setActiveTab('quests')}
        >
          {renderTabIcon('quests')}
          <span>Quests</span>
        </button>
        <button 
          className={`admin-tab ${activeTab === 'assign' ? 'active' : ''}`} 
          onClick={() => setActiveTab('assign')}
        >
          {renderTabIcon('assign')}
          <span>Assign</span>
        </button>
        <button 
          className={`admin-tab ${activeTab === 'assignments' ? 'active' : ''}`} 
          onClick={() => setActiveTab('assignments')}
        >
          {renderTabIcon('assignments')}
          <span>Assignments</span>
        </button>
        <button 
          className={`admin-tab ${activeTab === 'students' ? 'active' : ''}`} 
          onClick={() => setActiveTab('students')}
        >
          {renderTabIcon('students')}
          <span>Students</span>
        </button>
      </nav>

      {loading && <div className="admin-loading">Loading...</div>}

      {/* ============ SUBMISSIONS TAB ============ */}
      {!loading && activeTab === 'submissions' && (
        <div className="admin-content">
          <div className="admin-section-header">
            <h2>Quest Submissions</h2>
            <p>Review and approve student quest completions.</p>
          </div>

          {submissions.length === 0 ? (
            <div className="admin-empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
              <p>No submissions yet.</p>
            </div>
          ) : (
            <div className="submissions-grid">
              {/* Pending Submissions */}
              {submissions.filter(s => s.status === 'pending').length > 0 && (
                <div className="submission-section">
                  <h3 className="section-title section-title-pending">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12,6 12,12 16,14"/>
                    </svg>
                    Pending Approval ({submissions.filter(s => s.status === 'pending').length})
                  </h3>
                  {submissions.filter(s => s.status === 'pending').map((sub) => (
                    <div key={sub.id} className="submission-card submission-pending">
                      <div className="submission-content">
                        {sub.image_url && (
                          <img 
                            src={sub.image_url} 
                            alt="Submission proof" 
                            className="submission-image"
                          />
                        )}
                        <div className="submission-details">
                          <div className="submission-title">{sub.post_title}</div>
                          <div className="submission-meta">
                            by <strong>{sub.user_details?.name || sub.user_details?.username || 'Unknown'}</strong> • 
                            Quest: <strong>{sub.quests?.title}</strong> • 
                            <span className="submission-points">+{sub.quests?.points || 0} pts</span>
                          </div>
                          {sub.post_caption && (
                            <div className="submission-caption">
                              "{sub.post_caption}"
                            </div>
                          )}
                          <div className="submission-date">
                            Submitted: {new Date(sub.submitted_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="submission-actions">
                          <button
                            onClick={() => approveSubmission(sub)}
                            className="action-btn action-btn-approve"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20,6 9,17 4,12"/>
                            </svg>
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Reason for rejection (optional):')
                              rejectSubmission(sub.id, reason)
                            }}
                            className="action-btn action-btn-reject"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Approved Submissions */}
              {submissions.filter(s => s.status === 'approved').length > 0 && (
                <div className="submission-section">
                  <h3 className="section-title section-title-approved">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22,4 12,14.01 9,11.01"/>
                    </svg>
                    Approved ({submissions.filter(s => s.status === 'approved').length})
                  </h3>
                  {submissions.filter(s => s.status === 'approved').map((sub) => (
                    <div key={sub.id} className="submission-card submission-approved">
                      <div className="submission-row">
                        <div>
                          <div className="submission-title-sm">{sub.post_title}</div>
                          <div className="submission-meta-sm">
                            {sub.user_details?.name || 'Unknown'} • {sub.quests?.title} • +{sub.quests?.points || 0} pts
                          </div>
                        </div>
                        <span className="status-badge status-approved">Approved</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Rejected Submissions */}
              {submissions.filter(s => s.status === 'rejected').length > 0 && (
                <div className="submission-section">
                  <h3 className="section-title section-title-rejected">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    Rejected ({submissions.filter(s => s.status === 'rejected').length})
                  </h3>
                  {submissions.filter(s => s.status === 'rejected').map((sub) => (
                    <div key={sub.id} className="submission-card submission-rejected">
                      <div className="submission-row">
                        <div>
                          <div className="submission-title-sm">{sub.post_title}</div>
                          <div className="submission-meta-sm">
                            {sub.user_details?.name || 'Unknown'} • {sub.quests?.title}
                          </div>
                        </div>
                        <span className="status-badge status-rejected">Rejected</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ QUESTS TAB ============ */}
      {!loading && activeTab === 'quests' && (
        <div className="admin-content">
          <div className="admin-section-header">
            <h2>{isEditing ? 'Edit Quest' : 'Create Quest'}</h2>
          </div>
          
          <form onSubmit={handleQuestSubmit} className="admin-form">
            <div className="form-group">
              <label>Quest Title</label>
              <input
                value={questForm.title}
                onChange={(e) => setQuestForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Enter quest title..."
                required
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={questForm.description}
                onChange={(e) => setQuestForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe what users need to do..."
                rows={3}
                className="form-textarea"
              />
            </div>
            <div className="form-group">
              <label>Points</label>
              <input
                type="number"
                value={questForm.points}
                onChange={(e) => setQuestForm((f) => ({ ...f, points: e.target.value }))}
                placeholder="Points"
                min={0}
                className="form-input form-input-small"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {isEditing ? 'Update Quest' : 'Create Quest'}
              </button>
              {isEditing && (
                <button type="button" onClick={resetQuestForm} className="btn btn-secondary">
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="admin-section-header" style={{ marginTop: '2rem' }}>
            <h3>All Quests</h3>
          </div>
          
          {quests.length === 0 ? (
            <div className="admin-empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
              </svg>
              <p>No quests yet. Create one above!</p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Description</th>
                    <th>Points</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quests.map((q) => (
                    <tr key={q.id}>
                      <td className="table-title">{q.title}</td>
                      <td className="table-description">{q.description || '-'}</td>
                      <td><span className="points-badge">{q.points} pts</span></td>
                      <td>
                        <div className="table-actions">
                          <button onClick={() => editQuest(q)} className="action-btn action-btn-edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit
                          </button>
                          <button onClick={() => deleteQuest(q.id)} className="action-btn action-btn-delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3,6 5,6 21,6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ ASSIGN TAB ============ */}
      {!loading && activeTab === 'assign' && (
        <div className="admin-content">
          <div className="admin-section-header">
            <h2>Assign Quest to Students</h2>
            <p>Select a quest and students to assign it to.</p>
          </div>
          
          <form onSubmit={assignQuest} className="admin-form">
            <div className="form-group">
              <label>Select Quest</label>
              <select
                value={selectedQuestId}
                onChange={(e) => setSelectedQuestId(e.target.value)}
                className="form-select"
              >
                <option value="">Choose a quest...</option>
                {quests.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q.points} pts)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label>Select Students</label>
                <button type="button" onClick={selectAllStudents} className="btn btn-text">
                  {selectedUserIds.length === students.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="student-selection-list">
                {students.length === 0 ? (
                  <div className="student-empty">No students found</div>
                ) : (
                  students.map((s) => (
                    <label
                      key={s.user_id}
                      className={`student-item ${selectedUserIds.includes(s.user_id) ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(s.user_id)}
                        onChange={() => toggleUserSelection(s.user_id)}
                      />
                      <div className="student-info">
                        <div className="student-name">{s.name || s.username}</div>
                        <div className="student-username">{s.username}</div>
                      </div>
                      <div className="student-points">{s.points || 0} pts</div>
                    </label>
                  ))
                )}
              </div>
              <div className="selection-count">{selectedUserIds.length} student(s) selected</div>
            </div>

            <button
              type="submit"
              disabled={!selectedQuestId || selectedUserIds.length === 0}
              className={`btn btn-primary btn-large ${(!selectedQuestId || selectedUserIds.length === 0) ? 'btn-disabled' : ''}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              Assign Quest to {selectedUserIds.length} Student(s)
            </button>
          </form>
        </div>
      )}

      {/* ============ ASSIGNMENTS TAB ============ */}
      {!loading && activeTab === 'assignments' && (
        <div className="admin-content">
          <div className="admin-section-header">
            <h2>Quest Assignments</h2>
            <p>View and manage all quest assignments.</p>
          </div>
          
          {assignments.length === 0 ? (
            <div className="admin-empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <p>No assignments yet.</p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Quest</th>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => {
                    const student = users.find((u) => u.user_id === a.user_id)
                    return (
                      <tr key={a.id}>
                        <td>
                          <div className="table-title">{a.quests?.title || 'Unknown'}</div>
                          <div className="table-subtitle">{a.quests?.points || 0} pts</div>
                        </td>
                        <td>{student?.name || student?.username || a.user_id}</td>
                        <td>
                          <span className={`status-badge status-${a.status}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="table-date">{new Date(a.assigned_at).toLocaleDateString()}</td>
                        <td>
                          <div className="table-actions">
                            {a.status === 'completed' && (
                              <>
                                <button
                                  onClick={() => updateAssignmentStatus(a.id, 'approved')}
                                  className="action-btn action-btn-approve action-btn-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => updateAssignmentStatus(a.id, 'rejected')}
                                  className="action-btn action-btn-reject action-btn-sm"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => deleteAssignment(a.id)}
                              className="action-btn action-btn-delete action-btn-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ STUDENTS TAB ============ */}
      {!loading && activeTab === 'students' && (
        <div className="admin-content">
          <div className="admin-section-header">
            <h2>Students</h2>
            <p>View all registered students and their progress.</p>
          </div>
          
          {students.length === 0 ? (
            <div className="admin-empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <p>No students yet.</p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Points</th>
                    <th>Quests Completed</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.user_id}>
                      <td className="table-title">{s.name || '-'}</td>
                      <td>{s.username}</td>
                      <td>
                        <span className="points-badge points-badge-primary">{s.points || 0}</span>
                      </td>
                      <td>{s.quest_completed || 0}</td>
                      <td className="table-date">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
