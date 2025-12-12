import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { supabase } from '../SupaBase.js'

export function UserDashboard() {
  const navigate = useNavigate()
  const { user, signOut, isAdmin, loading: authLoading } = useAuth()
  
  const [userDetails, setUserDetails] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // STRICT: Double-check role - admin should NEVER see this
  useEffect(() => {
    if (authLoading) return
    if (isAdmin) {
      navigate('/admin', { replace: true })
    }
  }, [authLoading, isAdmin, navigate])

  useEffect(() => {
    if (authLoading || isAdmin) return
    loadData()
  }, [authLoading, isAdmin])

  async function loadData() {
    setLoading(true)
    setError(null)

    // Get user details first (to get the user_id)
    const { data: userDetailsData, error: userErr } = await supabase
      .from('user_details')
      .select('*')
      .eq('auth_id', user?.id)
      .single()

    if (userErr) {
      console.error('User details error:', userErr)
      setError(userErr.message)
      setLoading(false)
      return
    }

    setUserDetails(userDetailsData)

    // Get quest assignments using the bigint user_id
    const { data: assignmentsData, error: qErr } = await supabase
      .from('quest_assignments')
      .select('*, quests(id,title,description,points)')
      .eq('user_id', userDetailsData.user_id) // Use user_id (bigint)
      .order('assigned_at', { ascending: false })

    if (qErr) {
      console.error('Assignments error:', qErr)
      setError(qErr.message)
      setAssignments([])
    } else {
      setAssignments(assignmentsData || [])
    }

    setLoading(false)
  }

  // Clear success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  async function submitQuest(assignmentId) {
    setError(null)

    const { error: upErr } = await supabase
      .from('quest_assignments')
      .update({ status: 'completed' })
      .eq('id', assignmentId)

    if (upErr) {
      setError(upErr.message)
      return
    }

    setAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, status: 'completed' } : a))
    )
    setSuccess('Quest submitted for approval!')
  }

  const pendingQuests = assignments.filter((a) => a.status === 'assigned' || a.status === 'in_progress')
  const submittedQuests = assignments.filter((a) => a.status === 'completed')
  const approvedQuests = assignments.filter((a) => a.status === 'approved')
  const rejectedQuests = assignments.filter((a) => a.status === 'rejected')

  const statusColors = {
    assigned: { bg: '#e6f0ff', color: '#06f' },
    in_progress: { bg: '#fff3e6', color: '#f80' },
    completed: { bg: '#fff3e6', color: '#f80' },
    approved: { bg: '#e6ffe6', color: '#0a0' },
    rejected: { bg: '#ffe6e6', color: '#c00' },
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'system-ui', padding: '0 20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Student Dashboard</h1>
          <div style={{ color: '#555' }}>
            Welcome, <b>{userDetails?.name || user?.email}</b>
          </div>
        </div>
        <button onClick={signOut} style={{ padding: '10px 20px', borderRadius: 8, cursor: 'pointer' }}>
          Sign out
        </button>
      </header>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }}>
        <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#06f' }}>{userDetails?.points || 0}</div>
          <div style={{ color: '#666', fontSize: 14 }}>Total Points</div>
        </div>
        <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#0a0' }}>{approvedQuests.length}</div>
          <div style={{ color: '#666', fontSize: 14 }}>Quests Completed</div>
        </div>
        <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#f80' }}>{pendingQuests.length}</div>
          <div style={{ color: '#666', fontSize: 14 }}>Pending Quests</div>
        </div>
      </div>

      {/* Messages */}
      {error && <div style={{ color: '#b00020', background: '#ffeef0', padding: 12, borderRadius: 8, marginTop: 16 }}>{error}</div>}
      {success && <div style={{ color: '#0a0', background: '#e6ffe6', padding: 12, borderRadius: 8, marginTop: 16 }}>{success}</div>}

      {loading && <div style={{ marginTop: 24, color: '#888' }}>Loading your quests...</div>}

      {/* Pending Quests */}
      {!loading && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ marginBottom: 16 }}>Your Quests</h2>
          
          {pendingQuests.length === 0 && submittedQuests.length === 0 && approvedQuests.length === 0 && rejectedQuests.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: '#f9f9f9', borderRadius: 12, color: '#888' }}>
              No quests assigned yet. Check back later!
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {/* Active/Pending Quests */}
              {pendingQuests.length > 0 && (
                <>
                  <h3 style={{ color: '#06f', marginTop: 8, marginBottom: 4 }}>Active Quests</h3>
                  {pendingQuests.map((a) => (
                    <div key={a.id} style={{ border: '2px solid #06f', borderRadius: 12, padding: 16, background: 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 18 }}>{a.quests?.title}</div>
                          <div style={{ color: '#666', marginTop: 6 }}>{a.quests?.description || 'Complete this quest to earn points!'}</div>
                          <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 14 }}>
                            <span style={{ color: '#06f', fontWeight: 600 }}>+{a.quests?.points || 0} pts</span>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 10,
                                fontSize: 12,
                                background: statusColors[a.status]?.bg,
                                color: statusColors[a.status]?.color,
                              }}
                            >
                              {a.status}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => submitQuest(a.id)}
                          style={{
                            padding: '10px 20px',
                            borderRadius: 8,
                            background: '#06f',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Awaiting Approval */}
              {submittedQuests.length > 0 && (
                <>
                  <h3 style={{ color: '#f80', marginTop: 20, marginBottom: 4 }}>Awaiting Approval</h3>
                  {submittedQuests.map((a) => (
                    <div key={a.id} style={{ border: '1px solid #f80', borderRadius: 12, padding: 16, background: '#fffaf5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.quests?.title}</div>
                          <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>+{a.quests?.points || 0} pts</div>
                        </div>
                        <span style={{ padding: '4px 12px', borderRadius: 12, background: '#fff3e6', color: '#f80', fontSize: 12, fontWeight: 600 }}>
                          Pending Approval
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Completed/Approved */}
              {approvedQuests.length > 0 && (
                <>
                  <h3 style={{ color: '#0a0', marginTop: 20, marginBottom: 4 }}>Completed</h3>
                  {approvedQuests.map((a) => (
                    <div key={a.id} style={{ border: '1px solid #0a0', borderRadius: 12, padding: 16, background: '#f5fff5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.quests?.title}</div>
                          <div style={{ fontSize: 14, color: '#0a0', marginTop: 4 }}>+{a.quests?.points || 0} pts earned!</div>
                        </div>
                        <span style={{ padding: '4px 12px', borderRadius: 12, background: '#e6ffe6', color: '#0a0', fontSize: 12, fontWeight: 600 }}>
                          ✓ Approved
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Rejected */}
              {rejectedQuests.length > 0 && (
                <>
                  <h3 style={{ color: '#c00', marginTop: 20, marginBottom: 4 }}>Rejected</h3>
                  {rejectedQuests.map((a) => (
                    <div key={a.id} style={{ border: '1px solid #c00', borderRadius: 12, padding: 16, background: '#fff5f5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.quests?.title}</div>
                          <div style={{ fontSize: 14, color: '#c00', marginTop: 4 }}>Quest was rejected</div>
                        </div>
                        <span style={{ padding: '4px 12px', borderRadius: 12, background: '#ffe6e6', color: '#c00', fontSize: 12, fontWeight: 600 }}>
                          ✗ Rejected
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
