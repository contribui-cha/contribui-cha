/**
 * Utility functions for cleaning up event-related data from localStorage
 */

const EVENT_CACHE_KEYS = [
  'event_',
  'cards_',
  'unlock_modal_',
  'guest_form_',
  'payment_session_'
];

/**
 * Clean all localStorage data related to a specific event
 */
export const cleanEventFromLocalStorage = (eventId: string | number) => {
  const keys = Object.keys(localStorage);
  
  keys.forEach(key => {
    EVENT_CACHE_KEYS.forEach(prefix => {
      if (key.startsWith(prefix) && key.includes(eventId.toString())) {
        localStorage.removeItem(key);
        console.log(`Cleaned localStorage key: ${key}`);
      }
    });
  });
};

/**
 * Clean all event-related data from localStorage
 */
export const cleanAllEventDataFromLocalStorage = () => {
  const keys = Object.keys(localStorage);
  
  keys.forEach(key => {
    EVENT_CACHE_KEYS.forEach(prefix => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
        console.log(`Cleaned localStorage key: ${key}`);
      }
    });
  });
};

/**
 * Verify if cached event data is still valid by checking if event exists
 */
export const validateEventCache = async (eventId: string | number, supabase: any) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .single();

    if (error || !data) {
      console.log(`Event ${eventId} no longer exists, cleaning cache`);
      cleanEventFromLocalStorage(eventId);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating event cache:', error);
    cleanEventFromLocalStorage(eventId);
    return false;
  }
};