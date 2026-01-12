import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Database helper functions
export const db = {
  // Posts
  async getPosts() {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('Error fetching posts:', error)
    return data || []
  },

  async createPost(post) {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('posts')
      .insert([post])
      .select()
      .single()
    if (error) console.error('Error creating post:', error)
    return data
  },

  async updatePost(id, updates) {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) console.error('Error updating post:', error)
    return data
  },

  async deletePost(id) {
    if (!supabase) return false
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)
    if (error) console.error('Error deleting post:', error)
    return !error
  },

  // Performance data
  async getPerformance() {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('performance')
      .select('*')
      .order('posted_at', { ascending: false })
    if (error) console.error('Error fetching performance:', error)
    return data || []
  },

  async logPerformance(record) {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('performance')
      .insert([record])
      .select()
      .single()
    if (error) console.error('Error logging performance:', error)
    return data
  },

  async updatePerformance(id, updates) {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('performance')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) console.error('Error updating performance:', error)
    return data
  },

  // Settings
  async getSettings() {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .single()
    if (error && error.code !== 'PGRST116') console.error('Error fetching settings:', error)
    return data
  },

  async saveSettings(settings) {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('settings')
      .upsert([{ id: 1, ...settings }])
      .select()
      .single()
    if (error) console.error('Error saving settings:', error)
    return data
  },
}
