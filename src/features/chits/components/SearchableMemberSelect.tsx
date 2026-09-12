import React, { useState, useRef, useEffect } from 'react';
import { Member } from '@/types';
import { ChevronDown, Search, Check, X } from 'lucide-react';

interface SearchableMemberSelectProps {
  value: string;
  onChange: (memberId: string) => void;
  members: Member[];
  placeholder?: string;
  openUpward?: boolean;
}

export const SearchableMemberSelect: React.FC<SearchableMemberSelectProps> = ({
  value,
  onChange,
  members,
  placeholder = 'Not Assigned',
  openUpward = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedMember = members.find((m) => m.id === value);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredMembers = members.filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const nameMatch = (m.name || '').toLowerCase().includes(term);
    const rawPhone = (m.phone || '').replace(/\D/g, '');
    const cleanTerm = term.replace(/\D/g, '');
    const phoneMatch = (m.phone || '').toLowerCase().includes(term) || (cleanTerm.length > 0 && rawPhone.includes(cleanTerm));
    return nameMatch || phoneMatch;
  });

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full font-sans">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full bg-[#0B0F17] border ${
          value ? 'border-blue-500/50 text-slate-100 font-semibold shadow-sm' : 'border-[#1F293D] text-slate-400'
        } hover:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none transition-colors truncate flex items-center justify-between gap-1 text-left`}
        title={selectedMember ? `${selectedMember.name} (${selectedMember.phone || selectedMember.id})` : placeholder}
      >
        <span className="truncate">
          {selectedMember ? `${selectedMember.name} ${selectedMember.phone ? `(${selectedMember.phone})` : ''}` : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 w-full min-w-[250px] max-w-[320px] z-50 bg-[#0B0F17] border border-[#1F293D] rounded-xl shadow-2xl overflow-hidden animate-fadeIn ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          <div className="p-2 border-b border-[#1F293D] bg-[#101726]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search member..."
                className="w-full bg-[#0B0F17] border border-[#26344E] rounded-lg px-2 pl-8 pr-7 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 p-0.5 text-slate-400 hover:text-white cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-[#1F293D]/30 py-1">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#151D2F] transition-colors cursor-pointer ${
                value ? 'text-slate-400 hover:text-slate-200' : 'text-blue-400 font-semibold bg-blue-500/10'
              }`}
            >
              <span>{placeholder}</span>
              {!value && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
            </button>

            {filteredMembers.map((m) => {
              const isSelected = m.id === value;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelect(m.id)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#151D2F] transition-colors group cursor-pointer ${
                    isSelected ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-200'
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="font-medium text-slate-100 group-hover:text-blue-400 transition-colors">
                      {m.name}
                    </span>
                    {m.phone && <span className="text-[11px] text-slate-400 ml-1.5 font-mono">({m.phone})</span>}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                </button>
              );
            })}

            {filteredMembers.length === 0 && (
              <div className="py-4 text-center text-slate-500 text-xs px-2">
                No members found matching &quot;{searchTerm}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
