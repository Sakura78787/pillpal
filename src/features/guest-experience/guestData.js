import {
  createGuestEntityId,
  GUEST_USER_ID,
  guestSessionRepository,
} from './guestSession.js';

const COLLECTIONS = new Set(['medications', 'medicationLogs', 'healthRecords', 'appointments']);

const clone = (value) => JSON.parse(JSON.stringify(value));

const guestEntity = (item) => ({
  ...item,
  user_id: GUEST_USER_ID,
  is_guest: true,
  is_demo: false,
});

export const createGuestDataGateway = ({
  repository = guestSessionRepository,
  now = () => new Date(),
  createId = createGuestEntityId,
} = {}) => {
  const readSession = () => repository.read().session;

  const list = (collection, predicate = () => true) => {
    if (!COLLECTIONS.has(collection)) return [];
    return clone(readSession()[collection].filter(predicate));
  };

  const replaceCollection = (collection, items) => {
    const session = readSession();
    return repository.replace({ ...session, [collection]: items });
  };

  const create = (collection, data = {}) => {
    if (!COLLECTIONS.has(collection)) return { success: false, error: '访客体验数据类型无效。' };
    const timestamp = now().toISOString();
    const entity = guestEntity({
      ...data,
      id: data.id || createId(collection.slice(0, -1)),
      created_at: data.created_at || timestamp,
      updated_at: timestamp,
    });
    const result = replaceCollection(collection, [...list(collection), entity]);
    return result.success ? { ...result, data: entity } : result;
  };

  const update = (collection, entityId, updates = {}) => {
    if (!COLLECTIONS.has(collection)) return { success: false, error: '访客体验数据类型无效。' };
    const entities = list(collection);
    const index = entities.findIndex((item) => String(item.id) === String(entityId));
    if (index < 0) return { success: false, error: '访客体验数据不存在或已重置。' };
    const data = guestEntity({
      ...entities[index],
      ...updates,
      id: entities[index].id,
      created_at: entities[index].created_at,
      updated_at: now().toISOString(),
    });
    const result = replaceCollection(collection, entities.map((item, itemIndex) => (itemIndex === index ? data : item)));
    return result.success ? { ...result, data } : result;
  };

  return { list, create, update };
};

export const guestDataGateway = createGuestDataGateway();

export const getGuestWeeklySourceData = () => ({
  medications: guestDataGateway.list('medications', (item) => !item.deleted_at),
  medicationLogs: guestDataGateway.list('medicationLogs', (item) => !item.deleted_at),
  healthRecords: guestDataGateway.list('healthRecords', (item) => !item.deleted_at),
  appointments: guestDataGateway.list('appointments', (item) => !item.deleted_at),
});
