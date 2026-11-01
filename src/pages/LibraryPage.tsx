import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  ImageIcon,
  Gamepad2,
  Blocks,
  Search,
  Trash2,
  ExternalLink,
  Copy,
  Calendar,
  Layers,
  Trophy,
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Dialog } from '../components/ui/Dialog'
import { LoadingState } from '../components/ui/LoadingState'
import { useToast } from '../lib/toast'
import {
  listConversations,
  listImages,
  listAddons,
  deleteConversation,
  deleteImage,
  type ConversationRecord,
  type ImageRecord,
  type AddonRecord,
  type GameRecord,
} from '../lib/db'
import { listRecentGames } from '../lib/games/db'

type LibraryTab = 'all' | 'conversations' | 'images' | 'games' | 'addons'

export function LibraryPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState<LibraryTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Data collections
  const [conversations, setConversations] = useState<ConversationRecord[]>([])
  const [images, setImages] = useState<ImageRecord[]>([])
  const [games, setGames] = useState<GameRecord[]>([])
  const [addons, setAddons] = useState<AddonRecord[]>([])
  const [imageThumbnails, setImageThumbnails] = useState<Record<string, string>>({})

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'conversation' | 'image'
    id: string
    title: string
  } | null>(null)

  // Image detail preview modal
  const [previewImage, setPreviewImage] = useState<ImageRecord | null>(null)

  useEffect(() => {
    loadLibraryData()
  }, [])

  async function loadLibraryData() {
    try {
      setLoading(true)
      const [convList, imgList, gameList, addonList] = await Promise.all([
        listConversations().catch(() => []),
        listImages(100).catch(() => []),
        listRecentGames(undefined, 100).catch(() => []),
        listAddons().catch(() => []),
      ])

      setConversations(convList)
      setImages(imgList)
      setGames(gameList)
      setAddons(addonList)

      // Fetch thumbnails for images asynchronously
      imgList.slice(0, 30).forEach(async (img) => {
        try {
          const dataUrl = await invoke<string>('read_image_data_url', {
            filePath: img.file_path,
          })
          setImageThumbnails((prev) => ({ ...prev, [img.id]: dataUrl }))
        } catch {
          // Ignore if image file was moved or deleted from disk
        }
      })
    } catch (err) {
      console.error('Failed to load library:', err)
      showToast('Could not load all library items', 'warning')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteConfirmed() {
    if (!itemToDelete) return
    try {
      if (itemToDelete.type === 'conversation') {
        await deleteConversation(itemToDelete.id)
        setConversations((prev) => prev.filter((c) => c.id !== itemToDelete.id))
        showToast('Conversation deleted', 'info')
      } else if (itemToDelete.type === 'image') {
        await deleteImage(itemToDelete.id)
        setImages((prev) => prev.filter((i) => i.id !== itemToDelete.id))
        showToast('Image deleted from library', 'info')
      }
    } catch {
      showToast('Failed to delete item', 'warning')
    } finally {
      setItemToDelete(null)
    }
  }

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
    showToast('Prompt copied to clipboard', 'success')
  }

  // Filtered collections based on search query
  const q = searchQuery.toLowerCase().trim()

  const filteredConversations = useMemo(() => {
    if (!q) return conversations
    return conversations.filter((c) => c.title.toLowerCase().includes(q))
  }, [conversations, q])

  const filteredImages = useMemo(() => {
    if (!q) return images
    return images.filter(
      (img) =>
        img.prompt.toLowerCase().includes(q) ||
        (img.negative_prompt && img.negative_prompt.toLowerCase().includes(q)),
    )
  }, [images, q])

  const filteredGames = useMemo(() => {
    if (!q) return games
    return games.filter(
      (g) =>
        g.game_type.toLowerCase().includes(q) ||
        (g.result && g.result.toLowerCase().includes(q)) ||
        g.difficulty.toLowerCase().includes(q),
    )
  }, [games, q])

  const filteredAddons = useMemo(() => {
    if (!q) return addons
    return addons.filter(
      (a) => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q),
    )
  }, [addons, q])

  const totalFilteredCount =
    filteredConversations.length +
    filteredImages.length +
    filteredGames.length +
    filteredAddons.length

  const tabsConfig = [
    { id: 'all' as const, label: 'All', count: conversations.length + images.length + games.length + addons.length },
    { id: 'conversations' as const, label: 'Chats', count: conversations.length, icon: MessageSquare },
    { id: 'images' as const, label: 'Images', count: images.length, icon: ImageIcon },
    { id: 'games' as const, label: 'Games', count: games.length, icon: Gamepad2 },
    { id: 'addons' as const, label: 'Add-ons', count: addons.length, icon: Blocks },
  ]

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <PageHeader
        title="Library"
        description="Unified local repository for your chats, generated art, match histories, and custom add-ons."
      />

      {/* Control bar: Search + Dynamic Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search bar */}
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search library items..."
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] pl-10 pr-4 py-2 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none shadow-sm transition-all"
          />
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          {tabsConfig.map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === id
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]'
              }`}
            >
              {Icon && <Icon size={14} />}
              <span>{label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  activeTab === id
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--border)]/70 text-[var(--muted)]'
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <LoadingState label="Indexing your local library..." />
        </div>
      ) : totalFilteredCount === 0 ? (
        <EmptyState
          icon={Layers}
          title={searchQuery ? 'No matching items found' : 'Your library is empty'}
          description={
            searchQuery
              ? `No records matched your search query "${searchQuery}".`
              : 'Everything you create—chats, artwork, game matches, and add-ons—is automatically cataloged here.'
          }
        />
      ) : (
        <div className="space-y-8">
          {/* 1. Conversations Section */}
          {(activeTab === 'all' || activeTab === 'conversations') &&
            filteredConversations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare size={16} className="text-sky-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Conversations ({filteredConversations.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="group flex flex-col justify-between p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] transition-all shadow-[var(--shadow-card)]"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-semibold text-sm text-[var(--text)] line-clamp-1">
                            {conv.title}
                          </h4>
                          <Badge tone="neutral">Chat</Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] mt-1">
                          <Calendar size={12} />
                          <span>{new Date(conv.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]/60">
                        <Button
                          variant="secondary"
                          className="text-xs py-1 px-3"
                          onClick={() => navigate('/chat')}
                        >
                          <ExternalLink size={12} className="mr-1" /> Open
                        </Button>
                        <button
                          type="button"
                          onClick={() =>
                            setItemToDelete({
                              type: 'conversation',
                              id: conv.id,
                              title: conv.title,
                            })
                          }
                          className="p-1.5 rounded-lg text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Delete conversation"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* 2. Generated Images Section */}
          {(activeTab === 'all' || activeTab === 'images') && filteredImages.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon size={16} className="text-purple-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Generated Artworks ({filteredImages.length})
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredImages.map((img) => {
                  const thumb = imageThumbnails[img.id]
                  return (
                    <div
                      key={img.id}
                      className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-[var(--shadow-card)] flex flex-col justify-between"
                    >
                      {/* Image Thumbnail */}
                      <div
                        onClick={() => setPreviewImage(img)}
                        className="relative aspect-square bg-[var(--surface-muted)] cursor-pointer overflow-hidden flex items-center justify-center"
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={img.prompt}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <ImageIcon size={24} className="text-[var(--muted)] opacity-50" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                          View Details
                        </div>
                      </div>

                      {/* Info & Actions */}
                      <div className="p-2.5">
                        <p className="text-[11px] text-[var(--text)] line-clamp-1 font-medium">
                          {img.prompt}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-[var(--border)]/40 text-[10px] text-[var(--muted)]">
                          <span>
                            {img.width || 512}×{img.height || 512}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyPrompt(img.prompt)}
                              className="p-1 hover:text-[var(--text)]"
                              title="Copy prompt"
                            >
                              <Copy size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setItemToDelete({
                                  type: 'image',
                                  id: img.id,
                                  title: img.prompt,
                                })
                              }
                              className="p-1 hover:text-red-500"
                              title="Delete image"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 3. Game Matches Section */}
          {(activeTab === 'all' || activeTab === 'games') && filteredGames.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Gamepad2 size={16} className="text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Game History ({filteredGames.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredGames.map((game) => {
                  const isWin = game.result === 'win'
                  const isLoss = game.result === 'loss'
                  const gameName = game.game_type === 'ludo' ? 'Ludo Arena' : 'Tic-Tac-Toe'

                  return (
                    <div
                      key={game.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm ${
                            isWin
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : isLoss
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-blue-500/10 text-blue-500'
                          }`}
                        >
                          <Trophy size={18} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-xs text-[var(--text)]">{gameName}</h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--muted)]">
                            <span className="capitalize">Mode: {game.difficulty}</span>
                            <span>•</span>
                            <span>{new Date(game.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                            isWin
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : isLoss
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'bg-[var(--surface-muted)] text-[var(--muted)]'
                          }`}
                        >
                          {game.result || 'Draw'}
                        </span>
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          onClick={() => navigate('/play')}
                        >
                          Play
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. Add-ons Section */}
          {(activeTab === 'all' || activeTab === 'addons') && filteredAddons.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Blocks size={16} className="text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Installed Add-ons ({filteredAddons.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {filteredAddons.map((addon) => (
                  <div
                    key={addon.id}
                    className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] font-bold">
                        <Blocks size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-[var(--text)] line-clamp-1">
                          {addon.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] mt-0.5">
                          <span className="capitalize">{addon.type}</span>
                          <span>•</span>
                          <span>v{addon.version}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      className="text-xs px-3 py-1"
                      onClick={() => navigate('/addons')}
                    >
                      Launch
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog
        open={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        title="Delete Item"
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Are you sure you want to delete{' '}
            <strong className="text-[var(--text)] font-semibold">
              &quot;{itemToDelete?.title}&quot;
            </strong>
            ? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setItemToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDeleteConfirmed}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Image Preview Modal */}
      {previewImage && (
        <Dialog
          open={Boolean(previewImage)}
          onClose={() => setPreviewImage(null)}
          title="Artwork Details"
        >
          <div className="space-y-4">
            <div className="aspect-square w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              {imageThumbnails[previewImage.id] ? (
                <img
                  src={imageThumbnails[previewImage.id]}
                  alt={previewImage.prompt}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-[var(--muted)]">Loading image...</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-[var(--text)]">Prompt:</div>
              <p className="text-xs text-[var(--muted)] bg-[var(--surface-muted)] p-2.5 rounded-xl leading-relaxed">
                {previewImage.prompt}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--muted)] pt-2 border-t border-[var(--border)]">
              <span>
                Resolution: {previewImage.width || 512}×{previewImage.height || 512}
              </span>
              <Button onClick={() => handleCopyPrompt(previewImage.prompt)}>
                <Copy size={13} className="mr-1.5" /> Copy Prompt
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
