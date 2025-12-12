import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { supabase } from '../SupaBase.js'

export function AdminDashboard() {
  const navigate = useNavigate()
  const { user, signOut, isAdmin, loading: authLoading } = useAuth()

  const [users, setUsers] = useState([])
  const [quests, setQuests] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Active tab
  const [activeTab, setActiveTab] = useState('quests')

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
        const [usersResult, questsResult, assignmentsResult] = await Promise.all([
          supabase.from('user_details').select('*').order('created_at', { ascending: false }),
          supabase.from('quests').select('*').order('created_at', { ascending: false }),
          supabase.from('quest_assignments').select('*, quests(id,title,points)').order('assigned_at', { ascending: false }),
        ])

        if (cancelled) return

        if (usersResult.error) console.error('Users error:', usersResult.error)
        if (questsResult.error) console.error('Quests error:', questsResult.error)
        if (assignmentsResult.error) console.error('Assignments error:', assignmentsResult.error)

        setUsers(usersResult.data || [])
        setQuests(questsResult.data || [])
        setAssignments(assignmentsResult.data || [])
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
    const [usersResult, questsResult, assignmentsResult] = await Promise.all([
      supabase.from('user_details').select('*').order('created_at', { ascending: false }),
      supabase.from('quests').select('*').order('created_at', { ascending: false }),
      supabase.from('quest_assignments').select('*, quests(id,title,points)').order('assigned_at', { ascending: false }),
    ])
    setUsers(usersResult.data || [])
    setQuests(questsResult.data || [])
    setAssignments(assignmentsResult.data || [])
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

    // If approved, update user's points
    if (newStatus === 'approved') {
      const assignment = assignments.find((a) => a.id === assignmentId)
      if (assignment?.quests?.points && assignment?.user_id) {
        const userDetail = users.find((u) => u.user_id === assignment.user_id)
        if (userDetail) {
          await supabase
            .from('user_details')
            .update({
              points: (userDetail.points || 0) + assignment.quests.points,
              total_points_earned: (userDetail.total_points_earned || 0) + assignment.quests.points,
              quest_completed: (userDetail.quest_completed || 0) + 1,
            })
            .eq('user_id', userDetail.user_id)
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

  // ============ RENDER ============

  const tabStyle = (tab) => ({
    padding: '10px 20px',
    border: 'none',
    borderBottom: activeTab === tab ? '3px solid #06f' : '3px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontWeight: activeTab === tab ? 700 : 400,
    color: activeTab === tab ? '#06f' : '#555',
  })

  return (
    <div style={{ maxWidth: 1000, margin: '40px auto', fontFamily: 'system-ui', padding: '0 20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Admin Dashboard</h1>
          <div style={{ color: '#555' }}>
            Signed in as <b>{user?.email}</b> (admin)
          </div>
        </div>
        <button onClick={signOut} style={{ padding: '10px 20px', borderRadius: 8, cursor: 'pointer' }}>
          Sign out
        </button>
      </header>

      {/* Messages */}
      {error && <div style={{ color: '#b00020', background: '#ffeef0', padding: 12, borderRadius: 8, marginTop: 16 }}>{error}</div>}
      {success && <div style={{ color: '#0a0', background: '#e6ffe6', padding: 12, borderRadius: 8, marginTop: 16 }}>{success}</div>}

      {/* Tabs */}
      <nav style={{ borderBottom: '1px solid #ddd', marginTop: 24 }}>
        <button style={tabStyle('quests')} onClick={() => setActiveTab('quests')}>
          Quests ({quests.length})
        </button>
        <button style={tabStyle('assign')} onClick={() => setActiveTab('assign')}>
          Assign Quest
        </button>
        <button style={tabStyle('assignments')} onClick={() => setActiveTab('assignments')}>
          Assignments ({assignments.length})
        </button>
        <button style={tabStyle('students')} onClick={() => setActiveTab('students')}>
          Students ({students.length})
        </button>
      </nav>

      {loading && <div style={{ padding: 20 }}>Loading...</div>}

      {/* ============ QUESTS TAB ============ */}
      {!loading && activeTab === 'quests' && (
        <div style={{ marginTop: 20 }}>
          <h2>{isEditing ? 'Edit Quest' : 'Create Quest'}</h2>
          <form onSubmit={handleQuestSubmit} style={{ display: 'grid', gap: 12, maxWidth: 500, marginBottom: 30 }}>
            <input
              value={questForm.title}
              onChange={(e) => setQuestForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Quest title"
              required
              style={{ padding: 12, borderRadius: 6, border: '1px solid #ccc' }}
            />
            <textarea
              value={questForm.description}
              onChange={(e) => setQuestForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              rows={3}
              style={{ padding: 12, borderRadius: 6, border: '1px solid #ccc' }}
            />
            <input
              type="number"
              value={questForm.points}
              onChange={(e) => setQuestForm((f) => ({ ...f, points: e.target.value }))}
              placeholder="Points"
              min={0}
              style={{ padding: 12, borderRadius: 6, border: '1px solid #ccc', width: 120 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={{ padding: '10px 20px', borderRadius: 6, background: '#06f', color: 'white', border: 'none', cursor: 'pointer' }}>
                {isEditing ? 'Update Quest' : 'Create Quest'}
              </button>
              {isEditing && (
                <button type="button" onClick={resetQuestForm} style={{ padding: '10px 20px', borderRadius: 6, cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          <h3>All Quests</h3>
          {quests.length === 0 ? (
            <p style={{ color: '#888' }}>No quests yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                  <th style={{ padding: 10 }}>Title</th>
                  <th style={{ padding: 10 }}>Description</th>
                  <th style={{ padding: 10 }}>Points</th>
                  <th style={{ padding: 10 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quests.map((q) => (
                  <tr key={q.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 10, fontWeight: 600 }}>{q.title}</td>
                    <td style={{ padding: 10, color: '#666', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {q.description || '-'}
                    </td>
                    <td style={{ padding: 10 }}>{q.points} pts</td>
                    <td style={{ padding: 10 }}>
                      <button onClick={() => editQuest(q)} style={{ marginRight: 8, padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => deleteQuest(q.id)} style={{ padding: '6px 12px', borderRadius: 4, cursor: 'pointer', background: '#fee', color: '#c00' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ============ ASSIGN TAB ============ */}
      {!loading && activeTab === 'assign' && (
        <div style={{ marginTop: 20 }}>
          <h2>Assign Quest to Students</h2>
          <form onSubmit={assignQuest} style={{ maxWidth: 600 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600 }}>Select Quest</label>
              <select
                value={selectedQuestId}
                onChange={(e) => setSelectedQuestId(e.target.value)}
                style={{ width: '100%', padding: 12, marginTop: 6, borderRadius: 6, border: '1px solid #ccc' }}
              >
                <option value="">Choose a quest...</option>
                {quests.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q.points} pts)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontWeight: 600 }}>Select Students</label>
                <button type="button" onClick={selectAllStudents} style={{ padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                  {selectedUserIds.length === students.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div style={{ border: '1px solid #ccc', borderRadius: 6, maxHeight: 250, overflowY: 'auto' }}>
                {students.length === 0 ? (
                  <div style={{ padding: 16, color: '#888' }}>No students found</div>
                ) : (
                  students.map((s) => (
                    <label
                      key={s.user_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderBottom: '1px solid #eee',
                        cursor: 'pointer',
                        background: selectedUserIds.includes(s.user_id) ? '#e6f0ff' : 'white',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(s.user_id)}
                        onChange={() => toggleUserSelection(s.user_id)}
                        style={{ marginRight: 12 }}
                      />
                      <div>
                        <div style={{ fontWeight: 500 }}>{s.name || s.username}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{s.username}</div>
                      </div>
                      <div style={{ marginLeft: 'auto', fontSize: 12, color: '#666' }}>{s.points || 0} pts</div>
                    </label>
                  ))
                )}
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{selectedUserIds.length} student(s) selected</div>
            </div>

            <button
              type="submit"
              disabled={!selectedQuestId || selectedUserIds.length === 0}
              style={{
                padding: '12px 24px',
                borderRadius: 6,
                background: selectedQuestId && selectedUserIds.length > 0 ? '#06f' : '#ccc',
                color: 'white',
                border: 'none',
                cursor: selectedQuestId && selectedUserIds.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Assign Quest to {selectedUserIds.length} Student(s)
            </button>
          </form>
        </div>
      )}

      {/* ============ ASSIGNMENTS TAB ============ */}
      {!loading && activeTab === 'assignments' && (
        <div style={{ marginTop: 20 }}>
          <h2>Quest Assignments</h2>
          {assignments.length === 0 ? (
            <p style={{ color: '#888' }}>No assignments yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                  <th style={{ padding: 10 }}>Quest</th>
                  <th style={{ padding: 10 }}>Student</th>
                  <th style={{ padding: 10 }}>Status</th>
                  <th style={{ padding: 10 }}>Assigned</th>
                  <th style={{ padding: 10 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const student = users.find((u) => u.user_id === a.user_id)
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 10 }}>
                        <div style={{ fontWeight: 600 }}>{a.quests?.title || 'Unknown'}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{a.quests?.points || 0} pts</div>
                      </td>
                      <td style={{ padding: 10 }}>{student?.name || student?.username || a.user_id}</td>
                      <td style={{ padding: 10 }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            background:
                              a.status === 'approved' ? '#e6ffe6' : a.status === 'completed' ? '#fff3e6' : a.status === 'rejected' ? '#ffe6e6' : '#e6f0ff',
                            color: a.status === 'approved' ? '#0a0' : a.status === 'completed' ? '#f80' : a.status === 'rejected' ? '#c00' : '#06f',
                          }}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td style={{ padding: 10, fontSize: 12, color: '#666' }}>{new Date(a.assigned_at).toLocaleDateString()}</td>
                      <td style={{ padding: 10 }}>
                        {a.status === 'completed' && (
                          <>
                            <button
                              onClick={() => updateAssignmentStatus(a.id, 'approved')}
                              style={{ marginRight: 6, padding: '4px 10px', borderRadius: 4, background: '#e6ffe6', color: '#0a0', border: 'none', cursor: 'pointer' }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateAssignmentStatus(a.id, 'rejected')}
                              style={{ marginRight: 6, padding: '4px 10px', borderRadius: 4, background: '#ffe6e6', color: '#c00', border: 'none', cursor: 'pointer' }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => deleteAssignment(a.id)}
                          style={{ padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ============ STUDENTS TAB ============ */}
      {!loading && activeTab === 'students' && (
        <div style={{ marginTop: 20 }}>
          <h2>Students</h2>
          {students.length === 0 ? (
            <p style={{ color: '#888' }}>No students yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                  <th style={{ padding: 10 }}>Name</th>
                  <th style={{ padding: 10 }}>Email</th>
                  <th style={{ padding: 10 }}>Points</th>
                  <th style={{ padding: 10 }}>Quests Completed</th>
                  <th style={{ padding: 10 }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.user_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 10, fontWeight: 600 }}>{s.name || '-'}</td>
                    <td style={{ padding: 10 }}>{s.username}</td>
                    <td style={{ padding: 10 }}>
                      <span style={{ fontWeight: 700, color: '#06f' }}>{s.points || 0}</span>
                    </td>
                    <td style={{ padding: 10 }}>{s.quest_completed || 0}</td>
                    <td style={{ padding: 10, fontSize: 12, color: '#666' }}>
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
