import { PlayBlockItem } from "./PlayBlockItem";

export function PlayBlocksTab({
  playBlocks,
  editingBlock,
  setEditingBlock,
  updatePlayBlock,
  handleSaveBlock,
  loading,
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-black dark:text-white font-bricolage">
        Configure Play Blocks
      </h3>
      <div className="space-y-4">
        {playBlocks.map((block) => (
          <PlayBlockItem
            key={block.id}
            block={block}
            isEditing={editingBlock === block.id}
            onEdit={() => setEditingBlock(editingBlock === block.id ? null : block.id)}
            onSave={() => handleSaveBlock(block)}
            onCancel={() => setEditingBlock(null)}
            onUpdate={(field, value) => updatePlayBlock(block.id, field, value)}
            loading={loading[`block_${block.id}`]}
          />
        ))}
      </div>
    </div>
  );
}
