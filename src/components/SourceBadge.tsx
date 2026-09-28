import React, { useState } from 'react';
import { Source } from '../types';
import { FileText, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

interface SourceBadgeProps {
  sources: Source[];
  onSelectSourceQuery?: (queryText: string) => void;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ sources, onSelectSourceQuery }) => {
  const [expanded, setExpanded] = useState(true);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-subtle">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer text-xs font-semibold text-secondary hover:underline transition-colors py-1"
      >
        <div className="flex items-center space-x-2">
          <FileText className="w-3.5 h-3.5 text-secondary" />
          <span>Sources Used ({sources.length} document{sources.length > 1 ? 's' : ''})</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-secondary border border-purple-200 font-mono">
            Grounded Context
          </span>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </div>

      {expanded && (
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sources.map((src, idx) => (
            <div
              key={idx}
              onClick={() => {
                if (onSelectSourceQuery) {
                  onSelectSourceQuery(`What are the key details in ${src.documentName} page ${src.pageNumber}?`);
                }
              }}
              className={`p-2.5 rounded-lg bg-surface border border-subtle text-xs flex items-start space-x-2.5 shadow-sm transition-all ${
                onSelectSourceQuery ? 'cursor-pointer hover:border-purple-400 hover:bg-purple-50/40' : ''
              }`}
              title="Click to ask for more details from this document"
            >
              <FileText className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-heading truncate">{src.documentName}</div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-body">
                  <span>Page {src.pageNumber}</span>
                  <span className="text-emerald-600 font-mono text-[10px] font-semibold flex items-center">
                    <CheckCircle2 className="w-2.5 h-2.5 inline mr-0.5 text-emerald-500" />
                    {Math.round(src.similarityScore * 100)}% match
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
