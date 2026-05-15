
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Settings2, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { getFirebaseFirestore } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { CustomForm, FormFieldConfig } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// ─── Types ────────────────────────────────────────────────────────────────────
type FieldType =
  | 'text' | 'email' | 'password' | 'phone' | 'textarea'
  | 'select' | 'multiple-choice' | 'multiple-select' | 'date' | 'address';

type DataSource =
  | 'manual' | 'campuses' | 'ladders' | 'ministries'
  | 'charges' | 'roles' | 'languages' | 'genders'
  | 'ageRanges' | 'locationPreferences' | 'hpAvailabilityDays' | 'maritalStatuses';

// ─── Schema ───────────────────────────────────────────────────────────────────
const fieldConfigSchema = z.object({
  fieldId: z.string(),
  label: z.string(),
  visible: z.boolean(),
  required: z.boolean(),
  editable: z.boolean().optional().default(true),
  type: z.string().optional(),
  dataSource: z.string().optional(),
  dataSourceOptions: z.object({
    ladders: z.array(z.string()).optional(),
    campuses: z.array(z.string()).optional(),
  }).optional(),
});

const formBuilderSchema = z.object({
  title: z.string().min(1, 'Form title is required.'),
  type: z.enum(['userProfile', 'custom', 'hybrid']),
  fields: z.array(fieldConfigSchema),
  public: z.boolean().default(false),
  submissionCount: z.number().default(0),
});

type FormBuilderValues = z.infer<typeof formBuilderSchema>;

// ─── Default field configuration ─────────────────────────────────────────────
interface UserProfileFieldDef {
  fieldId: string;
  label: string;
  defaultType: FieldType;
  defaultDataSource?: DataSource;
  lockType?: boolean; // if true, type cannot be changed (e.g. password, email)
}

const USER_PROFILE_FIELDS: UserProfileFieldDef[] = [
  { fieldId: 'firstName',         label: 'First Name',                    defaultType: 'text' },
  { fieldId: 'lastName',          label: 'Last Name',                     defaultType: 'text' },
  { fieldId: 'email',             label: 'Email Address',                 defaultType: 'email',    lockType: true },
  { fieldId: 'password',          label: 'Password',                      defaultType: 'password', lockType: true },
  { fieldId: 'phoneNumber',       label: 'Phone Number',                  defaultType: 'phone',    lockType: true },
  { fieldId: 'gender',            label: 'Gender',                        defaultType: 'select',   defaultDataSource: 'genders' },
  { fieldId: 'ageRange',          label: 'Age Range',                     defaultType: 'select',   defaultDataSource: 'ageRanges' },
  { fieldId: 'maritalStatus',     label: 'Marital Status',                defaultType: 'select',   defaultDataSource: 'maritalStatuses' },
  { fieldId: 'isBaptized',        label: 'Are you baptized?',             defaultType: 'select' },
  { fieldId: 'denomination',      label: 'Denomination (if baptized)',     defaultType: 'select' },
  { fieldId: 'campus',            label: 'Campus',                        defaultType: 'select',   defaultDataSource: 'campuses' },
  { fieldId: 'language',          label: 'Preferred Language',            defaultType: 'select',   defaultDataSource: 'languages' },
  { fieldId: 'locationPreference',label: 'Location Preference',           defaultType: 'select',   defaultDataSource: 'locationPreferences' },
  { fieldId: 'isInHpGroup',       label: 'Are you in a Prayer Group (HP)?', defaultType: 'select' },
  { fieldId: 'hpNumber',          label: 'HP Number',                     defaultType: 'text' },
  { fieldId: 'facilitatorName',   label: "Facilitator's Name",            defaultType: 'text' },
  { fieldId: 'hpAvailabilityDay', label: 'HP Availability Day',           defaultType: 'select',   defaultDataSource: 'hpAvailabilityDays' },
  { fieldId: 'hpAvailabilityTime',label: 'HP Availability Time',          defaultType: 'text' },
  { fieldId: 'classLadderId',     label: 'Class Level (Ladder)',          defaultType: 'select',   defaultDataSource: 'ladders' },
  { fieldId: 'ministry',          label: 'Ministry',                      defaultType: 'select',   defaultDataSource: 'ministries' },
  { fieldId: 'charge',            label: 'Charge',                        defaultType: 'select',   defaultDataSource: 'charges' },
  { fieldId: 'bio',               label: 'Bio',                           defaultType: 'textarea' },
];

const CORE_REQUIRED_FIELDS = ['firstName', 'lastName', 'email', 'password'];

const getInitialFields = (): FormFieldConfig[] => {
  return USER_PROFILE_FIELDS.map(f => ({
    fieldId: f.fieldId,
    label: f.label,
    visible: CORE_REQUIRED_FIELDS.includes(f.fieldId),
    required: CORE_REQUIRED_FIELDS.includes(f.fieldId),
    editable: true,
    type: f.defaultType,
    dataSource: f.defaultDataSource,
    dataSourceOptions: {},
  }));
};

// Field type options for the dropdown
const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text',             label: 'Text' },
  { value: 'textarea',         label: 'Long Text (Textarea)' },
  { value: 'select',           label: 'Dropdown (Select)' },
  { value: 'multiple-choice',  label: 'Multiple Choice' },
  { value: 'multiple-select',  label: 'Multiple Select (Checkboxes)' },
  { value: 'date',             label: 'Date' },
  { value: 'address',          label: 'Address' },
];

// Data source options for select/multiple-choice fields
const DATA_SOURCE_OPTIONS: { value: DataSource; label: string }[] = [
  { value: 'manual',              label: 'Manual (enter options below)' },
  { value: 'campuses',            label: 'Campuses (from database)' },
  { value: 'ladders',             label: 'Class Levels / Ladders (from database)' },
  { value: 'ministries',          label: 'Ministries (from database)' },
  { value: 'charges',             label: 'Charges (from database)' },
  { value: 'languages',           label: 'Languages (published, from database)' },
  { value: 'genders',             label: 'Genders (Male / Female)' },
  { value: 'ageRanges',           label: 'Age Ranges' },
  { value: 'locationPreferences', label: 'Location Preferences (Onsite / Online)' },
  { value: 'hpAvailabilityDays',  label: 'HP Availability Days (Mon–Sun)' },
  { value: 'maritalStatuses',     label: 'Marital Statuses' },
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface FormBuilderProps {
  formType: 'userProfile' | 'custom' | 'hybrid' | null;
  formId?: string | null;
}

// ─── Option filter items stored in state (campuses / ladders) ─────────────────
interface FilterableItem {
  id: string;
  label: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FormBuilder({ formType, formId }: FormBuilderProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingForm, setLoadingForm] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Filterable items loaded from Firestore for campuses/ladders filters
  const [campusItems, setCampusItems] = useState<FilterableItem[]>([]);
  const [ladderItems, setLadderItems] = useState<FilterableItem[]>([]);
  const [loadingFilterItems, setLoadingFilterItems] = useState(false);

  const form = useForm<FormBuilderValues>({
    resolver: zodResolver(formBuilderSchema),
    defaultValues: {
      title: formType === 'userProfile' ? 'New User Registration' : 'New Form',
      type: formType || 'userProfile',
      fields: getInitialFields(),
      public: false,
      submissionCount: 0,
    },
  });

  const { control, register, handleSubmit, watch, setValue, formState: { errors } } = form;
  const { fields } = useFieldArray({ control, name: 'fields' });

  // ── Load existing form if editing ──
  useEffect(() => {
    if (!formId) {
      setLoadingForm(false);
      return;
    }
    const db = getFirebaseFirestore();
    getDoc(doc(db, 'forms', formId))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data() as FormBuilderValues;
          // Ensure all fields have default type/dataSource from definition if missing (backward compat)
          const mergedFields = (data.fields || []).map(f => {
            const def = USER_PROFILE_FIELDS.find(d => d.fieldId === f.fieldId);
            return {
              ...f,
              type: f.type || def?.defaultType || 'text',
              dataSource: f.dataSource || def?.defaultDataSource,
              editable: f.editable !== undefined ? f.editable : true,
            };
          });
          form.reset({ ...data, fields: mergedFields });
        }
      })
      .catch(err => {
        console.error('Failed to load form:', err);
        toast({ variant: 'destructive', title: 'Could not load form data.' });
      })
      .finally(() => setLoadingForm(false));
  }, [formId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load filterable Firestore items ──
  useEffect(() => {
    if (formType !== 'userProfile' && !formId) return;
    const db = getFirebaseFirestore();
    setLoadingFilterItems(true);
    Promise.all([
      getDocs(query(collection(db, 'Campus'), orderBy('Campus Name'))),
      getDocs(query(collection(db, 'courseLevels'), orderBy('order'))),
    ])
      .then(([campusSnap, ladderSnap]) => {
        setCampusItems(
          campusSnap.docs
            .map(d => ({ id: d.id, label: d.data()['Campus Name'] as string }))
            .filter(c => c.label && c.label !== 'App Campus')
        );
        setLadderItems(
          ladderSnap.docs.map(d => ({ id: d.id, label: d.data().name as string }))
        );
      })
      .catch(err => console.error('Failed to load filter items:', err))
      .finally(() => setLoadingFilterItems(false));
  }, [formType, formId]);

  // ── Strip undefined values (Firestore rejects them) ──
  const sanitize = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(sanitize);
    if (obj !== null && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, sanitize(v)])
      );
    }
    return obj;
  };

  // ── Submit ──
  const onSubmit = async (data: FormBuilderValues) => {
    setIsSubmitting(true);
    try {
      const db = getFirebaseFirestore();
      const cleanData = sanitize(data);
      if (formId) {
        await updateDoc(doc(db, 'forms', formId), {
          ...cleanData,
          updatedAt: serverTimestamp(),
        });
        toast({ title: 'Form Updated', description: `"${data.title}" has been saved.` });
      } else {
        await addDoc(collection(db, 'forms'), {
          ...cleanData,
          submissionCount: 0,
          public: false,
          createdAt: serverTimestamp(),
        });
        toast({ title: 'Form Created', description: `"${data.title}" has been saved.` });
      }
      router.push('/admin/forms');
    } catch (error) {
      console.error('Error saving form:', error);
      toast({ variant: 'destructive', title: 'Failed to save form.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Redirect custom forms to blank-form builder ──
  const currentType = watch('type');
  useEffect(() => {
    if (!loadingForm && currentType === 'custom' && !formId) {
      router.replace('/admin/forms/builder/blank-form?type=custom');
    }
  }, [currentType, formId, loadingForm, router]);

  // ── Toggle a filter item (campus or ladder) ──
  const toggleFilterItem = useCallback((
    index: number,
    key: 'campuses' | 'ladders',
    itemId: string,
    currentOptions: string[] = []
  ) => {
    const next = currentOptions.includes(itemId)
      ? currentOptions.filter(id => id !== itemId)
      : [...currentOptions, itemId];
    setValue(`fields.${index}.dataSourceOptions.${key}`, next, { shouldDirty: true });
  }, [setValue]);

  if (loadingForm) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Form title */}
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <Label htmlFor="title" className="text-sm font-medium">Form Title</Label>
            <Input
              id="title"
              className="text-2xl font-bold h-auto p-0 border-none focus-visible:ring-0 shadow-none"
              placeholder="Enter form title..."
              {...register('title')}
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
        </CardHeader>
      </Card>

      {/* Fields list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Form Fields</h2>
          <p className="text-sm text-muted-foreground">Click a field to configure its type and behavior</p>
        </div>

        {fields.map((field, index) => {
          const fieldDef = USER_PROFILE_FIELDS.find(d => d.fieldId === field.fieldId);
          const isExpanded = expandedIndex === index;

          const watchedVisible  = watch(`fields.${index}.visible`);
          const watchedRequired = watch(`fields.${index}.required`);
          const watchedEditable = watch(`fields.${index}.editable`);
          const watchedType     = watch(`fields.${index}.type`) as FieldType | undefined;
          const watchedDS       = watch(`fields.${index}.dataSource`) as DataSource | undefined;
          const watchedDSOpts   = watch(`fields.${index}.dataSourceOptions`);

          const isSelectType = ['select', 'multiple-choice', 'multiple-select'].includes(watchedType || '');
          const showCampusFilter = isSelectType && watchedDS === 'campuses';
          const showLadderFilter = isSelectType && watchedDS === 'ladders';
          const isLocked = fieldDef?.lockType === true;

          const selectedCampuses = watchedDSOpts?.campuses || [];
          const selectedLadders  = watchedDSOpts?.ladders  || [];

          return (
            <Collapsible key={field.id} open={isExpanded} onOpenChange={(open) => setExpandedIndex(open ? index : null)}>
              <Card className={`transition-all ${watchedVisible ? '' : 'opacity-60'}`}>
                {/* ── Row: always visible summary ── */}
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{field.label}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs capitalize">
                              {watchedType || 'text'}
                            </Badge>
                            {watchedDS && watchedDS !== 'manual' && (
                              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                <Database className="h-3 w-3" />
                                {watchedDS}
                              </Badge>
                            )}
                            {isLocked && (
                              <Badge variant="secondary" className="text-xs">locked type</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Visible toggle */}
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Switch
                            id={`visible-${index}`}
                            checked={!!watchedVisible}
                            onCheckedChange={checked => setValue(`fields.${index}.visible`, checked, { shouldDirty: true })}
                          />
                          <Label htmlFor={`visible-${index}`} className="text-sm cursor-pointer">Visible</Label>
                        </div>
                        {/* Required toggle */}
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Switch
                            id={`required-${index}`}
                            checked={!!watchedRequired}
                            disabled={!watchedVisible}
                            onCheckedChange={checked => setValue(`fields.${index}.required`, checked, { shouldDirty: true })}
                          />
                          <Label htmlFor={`required-${index}`} className="text-sm cursor-pointer">Required</Label>
                        </div>
                        {/* Expand icon — intentionally NOT stopPropagation so it triggers Collapsible */}
                        <Button variant="ghost" size="icon" type="button" className="shrink-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                {/* ── Expanded settings ── */}
                <CollapsibleContent>
                  <CardContent className="border-t pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Field Label */}
                      <div className="space-y-1">
                        <Label>Field Label</Label>
                        <Input
                          {...register(`fields.${index}.label`)}
                          placeholder="Label displayed to users"
                        />
                      </div>

                      {/* Field Type */}
                      <div className="space-y-1">
                        <Label>Input Type</Label>
                        <Controller
                          name={`fields.${index}.type`}
                          control={control}
                          render={({ field: ctrl }) => (
                            <Select
                              value={ctrl.value || 'text'}
                              onValueChange={val => {
                                ctrl.onChange(val);
                                // Reset data source if type is no longer a select
                                if (!['select', 'multiple-choice', 'multiple-select'].includes(val)) {
                                  setValue(`fields.${index}.dataSource`, undefined, { shouldDirty: true });
                                  setValue(`fields.${index}.dataSourceOptions`, {}, { shouldDirty: true });
                                }
                              }}
                              disabled={isLocked}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TYPE_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {isLocked && (
                          <p className="text-xs text-muted-foreground">Type is locked for this field to preserve functionality.</p>
                        )}
                      </div>

                      {/* Editable toggle */}
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">Editable by User</p>
                          <p className="text-xs text-muted-foreground">Allow users to edit this field after registration</p>
                        </div>
                        <Switch
                          checked={watchedEditable !== false}
                          onCheckedChange={checked => setValue(`fields.${index}.editable`, checked, { shouldDirty: true })}
                        />
                      </div>

                      {/* Data Source (only for select-type fields) */}
                      {isSelectType && (
                        <div className="space-y-1">
                          <Label>Data Source</Label>
                          <Controller
                            name={`fields.${index}.dataSource`}
                            control={control}
                            render={({ field: ctrl }) => (
                              <Select
                                value={ctrl.value || 'manual'}
                                onValueChange={val => {
                                  ctrl.onChange(val);
                                  setValue(`fields.${index}.dataSourceOptions`, {}, { shouldDirty: true });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select source..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {DATA_SOURCE_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      )}
                    </div>

                    {/* ── Campus filter ── */}
                    {showCampusFilter && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Filter Campuses
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {selectedCampuses.length === 0
                              ? 'All campuses shown (no filter applied)'
                              : `${selectedCampuses.length} campus(es) selected`}
                          </p>
                        </div>
                        {loadingFilterItems ? (
                          <Skeleton className="h-24 w-full" />
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 rounded-lg border p-3 max-h-48 overflow-y-auto">
                            {campusItems.map(campus => (
                              <div key={campus.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`campus-${index}-${campus.id}`}
                                  checked={selectedCampuses.includes(campus.id)}
                                  onCheckedChange={() => toggleFilterItem(index, 'campuses', campus.id, selectedCampuses)}
                                />
                                <Label htmlFor={`campus-${index}-${campus.id}`} className="text-sm font-normal cursor-pointer">
                                  {campus.label}
                                </Label>
                              </div>
                            ))}
                            {campusItems.length === 0 && (
                              <p className="text-xs text-muted-foreground col-span-3">No campuses found in database.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Ladder filter ── */}
                    {showLadderFilter && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Filter Class Levels
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {selectedLadders.length === 0
                              ? 'All levels shown (no filter applied)'
                              : `${selectedLadders.length} level(s) selected`}
                          </p>
                        </div>
                        {loadingFilterItems ? (
                          <Skeleton className="h-24 w-full" />
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 rounded-lg border p-3">
                            {ladderItems.map(ladder => (
                              <div key={ladder.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`ladder-${index}-${ladder.id}`}
                                  checked={selectedLadders.includes(ladder.id)}
                                  onCheckedChange={() => toggleFilterItem(index, 'ladders', ladder.id, selectedLadders)}
                                />
                                <Label htmlFor={`ladder-${index}-${ladder.id}`} className="text-sm font-normal cursor-pointer">
                                  {ladder.label}
                                </Label>
                              </div>
                            ))}
                            {ladderItems.length === 0 && (
                              <p className="text-xs text-muted-foreground col-span-3">No class levels found in database.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {formId ? 'Save Changes' : 'Create Form'}
        </Button>
      </div>
    </form>
  );
}
