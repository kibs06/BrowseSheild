import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import './AnimatedList.css';

function AnimatedItem({
  children,
  delay = 0,
  index,
  onMouseEnter,
  onClick,
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.35, once: false });

  return (
    <motion.div
      ref={ref}
      data-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.96, opacity: 0, y: 16 }}
      animate={inView ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.96, opacity: 0, y: 16 }}
      transition={{ duration: 0.24, delay }}
      className="animated-list-item-shell"
    >
      {children}
    </motion.div>
  );
}

export default function AnimatedList({
  items = [
    'Item 1',
    'Item 2',
    'Item 3',
    'Item 4',
    'Item 5',
    'Item 6',
    'Item 7',
    'Item 8',
    'Item 9',
    'Item 10',
  ],
  onItemSelect,
  renderItem,
  showGradients = true,
  enableArrowNavigation = true,
  className = '',
  itemClassName = '',
  displayScrollbar = true,
  initialSelectedIndex = -1,
}) {
  const listRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [topGradientOpacity, setTopGradientOpacity] = useState(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(1);

  const updateGradients = useCallback((element) => {
    if (!element) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = element;
    setTopGradientOpacity(Math.min(scrollTop / 40, 1));

    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 40, 1));
  }, []);

  const handleItemMouseEnter = useCallback((index) => {
    setSelectedIndex(index);
  }, []);

  const handleItemClick = useCallback(
    (item, index) => {
      setSelectedIndex(index);
      if (onItemSelect) {
        onItemSelect(item, index);
      }
    },
    [onItemSelect],
  );

  const handleScroll = useCallback(
    (event) => {
      updateGradients(event.currentTarget);
    },
    [updateGradients],
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (!enableArrowNavigation) {
        return;
      }

      if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
        event.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((previousIndex) => Math.min(previousIndex + 1, items.length - 1));
      } else if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
        event.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((previousIndex) => Math.max(previousIndex - 1, 0));
      } else if (event.key === 'Enter' && selectedIndex >= 0 && selectedIndex < items.length) {
        event.preventDefault();
        if (onItemSelect) {
          onItemSelect(items[selectedIndex], selectedIndex);
        }
      }
    },
    [enableArrowNavigation, items, onItemSelect, selectedIndex],
  );

  useEffect(() => {
    updateGradients(listRef.current);
  }, [items, updateGradients]);

  useEffect(() => {
    if (!keyboardNav || selectedIndex < 0 || !listRef.current) {
      return;
    }

    const container = listRef.current;
    const selectedItem = container.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedItem) {
      const extraMargin = 40;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const itemTop = selectedItem.offsetTop;
      const itemBottom = itemTop + selectedItem.offsetHeight;

      if (itemTop < containerScrollTop + extraMargin) {
        container.scrollTo({ top: itemTop - extraMargin, behavior: 'smooth' });
      } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
        container.scrollTo({
          top: itemBottom - containerHeight + extraMargin,
          behavior: 'smooth',
        });
      }
    }

    setKeyboardNav(false);
  }, [keyboardNav, selectedIndex]);

  useEffect(() => {
    if (!items.length) {
      setSelectedIndex(-1);
      return;
    }

    setSelectedIndex((previousIndex) => {
      if (previousIndex < 0) {
        return initialSelectedIndex;
      }
      return Math.min(previousIndex, items.length - 1);
    });
  }, [initialSelectedIndex, items]);

  return (
    <div className={`scroll-list-container ${className}`.trim()}>
      <div
        ref={listRef}
        className={`scroll-list ${!displayScrollbar ? 'no-scrollbar' : ''}`.trim()}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={enableArrowNavigation ? 0 : undefined}
      >
        {items.map((item, index) => (
          <AnimatedItem
            key={typeof item === 'string' ? `${item}-${index}` : index}
            delay={index * 0.035}
            index={index}
            onMouseEnter={() => handleItemMouseEnter(index)}
            onClick={() => handleItemClick(item, index)}
          >
            {renderItem ? (
              renderItem(item, { index, isSelected: selectedIndex === index })
            ) : (
              <div className={`item ${selectedIndex === index ? 'selected' : ''} ${itemClassName}`.trim()}>
                <p className="item-text">{String(item)}</p>
              </div>
            )}
          </AnimatedItem>
        ))}
      </div>
      {showGradients ? (
        <>
          <div className="top-gradient" style={{ opacity: topGradientOpacity }} />
          <div className="bottom-gradient" style={{ opacity: bottomGradientOpacity }} />
        </>
      ) : null}
    </div>
  );
}
